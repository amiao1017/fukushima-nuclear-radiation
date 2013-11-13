// Adapted after Robin Kraft
// http:://www.reddmetrics.com/2011/08/10/fusion-tables-javascript-query-maps.html
// http://jsfiddle.net/odi86/Sbt2P/

function demoinit() {

    // Centered on Indonesia
    var latlon = new google.maps.LatLng(37.422972, 141.032917);

    var options = {
        disableDefaultUI: true,
        zoom: 10,
        center: latlon,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        mapTypeControl: true,
        scaleControl: true,
        zoomControl: true
    };

    mymap = new google.maps.Map(document.getElementById("map-canvas"), options);

    // var measurementLayer = new google.maps.FusionTablesLayer({
    // 	query: {
    // 	    select: 'Radiation',
    // 	    from: '1BRq9Wvu9yPTov_nfrf9xyUlmbPgG_8B8aA_i3uQ'
    // 	},
    // 	map: mymap,
    // 	suppressInfoWindows: true
    // });

    var govURL = getQueryURL('1jl5I-8zA1Ijt1wEUYLmB4ji3de5YzHMi_IpfgKI');
    var citURL = getQueryURL('15a9rZ0qPnjGW59nBWBd0KgR8hDyVct1KNX_pKwA');

    function runGov() {
	console.log(govURL);
	return $.get(govURL, dataHandler, "jsonp");
    }

    $.when(runGov()).done(function() {
	return $.get(citURL, dataHandler2, "jsonp");
    });

}

function getQueryURL(table) {
    var queryUrlHead = 'https://www.googleapis.com/fusiontables/v1/query?sql=';

    var queryUrlTail = '&key=AIzaSyAq4M53XkVSjRwNweNooYwsyaSOWKeHWws';

    //var queryUrlTail = '&jsonCallback=?'; // ? could be a function name
    
    //var pickedDate = '2011-11-01';
    var pickedDate = document.getElementById('datepicker').value;

    var query = "SELECT Radiation, Latitude, Longitude, Date FROM " + table + 
	" WHERE Date = '"+ pickedDate + "' LIMIT 1000";
    var queryurl = encodeURI(queryUrlHead + query + queryUrlTail);

    return queryurl;
}

function dataHandler(d) {
    console.log(d);
    // get the actual data out of the JSON object
    var data = d.rows;

    infoWindow = new google.maps.InfoWindow();

    // heatmap data
    var heatmapData = [];

    // loop through all rows to add them to the map
    for (var i = 0; i < data.length; i++) {

        var latlon = new google.maps.LatLng(data[i][1], data[i][2]);
        var probability = data[i][0];

	var weightedLoc = {
	    location: latlon,
	    weight: Math.pow(2, probability - 3.0)
	};

	heatmapData.push(weightedLoc);

	var marker = new google.maps.Marker({
	    position: latlon,
	    rowid: i,
	    prob: probability,
	    //animation: google.maps.Animation.BOUNCE,
	    icon: getCircle(2),
	    zIndex: 0, // not working
	    map: mymap
	});

	var fn = markerClick(mymap, marker, infoWindow);
	google.maps.event.addListener(marker, 'click', fn);

    }

    $.ajax({
	url:"/query",
	type: 'POST',
	data: {data: JSON.stringify(data)}
    }).done(function(data) {
	success: console.log('success')
	// success: function(msg) {
	//     var interpolatedHeatmapData = [];
	    
	//     for (var i = 0; i < msg['out'].length; i++) {
	// 	var latlon = new google.maps.LatLng(msg['out'][i]['location']['nb'], 
	// 					    msg['out'][i]['location']['ob']);
	// 	interpolatedHeatmapData.push({location: latlon, 
	// 				      weight: msg['out'][i]['weight']});
	//     };
    });

    console.log({heatmapData: heatmapData});

    var heatmap = new google.maps.visualization.HeatmapLayer({
    	data: heatmapData,
    	dissipating: true,
    	opacity: .5,
    	radius: 22,
    	maxIntensity: 25,
    	map: mymap
    });

}

function dataHandler2(d) {
    console.log(d);
    var data = d.rows;
    
    function boink(data) {
    	return $.ajax({
    	    url:"/sign",
    	    type: 'POST',
    	    data: data,
	    datatype: 'json'
	});
    }

    var model_choice = document.getElementById('model').value

    var choose = boink({data: JSON.stringify(data), choice: JSON.stringify(model_choice)})
	.done(function(sign) {
	    console.log('(Citizen Data) / (Smoothed Government Data): ', sign['result']);
	    console.log('Leave one out cross validation MSE: ', sign['cv_results']);
	    
	    var cv = document.getElementById('cv').innerHTML=sign['cv_results'];
	    
	    infoWindow = new google.maps.InfoWindow();
	    
	    for (var i = 0; i < data.length; i++) {
		(function(i, data) {
		    setTimeout(function() { // http://jsfiddle.net/yV6xv/128/
			var latlon = new google.maps.LatLng(data[i][1], data[i][2]);
			var probability = data[i][0];
			
			var prop = document.getElementById('prop').value / 100.0;
			if (prop.length == 0) {
		     	    prop = 0;
			}
			console.log(prop);
			
			var iconStyle = chooseColor(prop, sign['result'][i]);
			
			var marker = new google.maps.Marker({
			    position: latlon,
			    rowid: i,
			    prob: probability,
			    animation: google.maps.Animation.DROP,
			    icon: iconStyle,
			    map: mymap
			});
			
			var fn = markerClick(mymap, marker, infoWindow);
			google.maps.event.addListener(marker, 'click', fn);
			
		    }, i *  Math.min(10 * 1000 / data.length, 200));
		    
		}(i, data));
	    }
	});
}


function getCircle(magnitude) {
    var circle = {
	path: google.maps.SymbolPath.CIRCLE,
	fillColor: 'black',
	fillOpacity: 0,
	scale: magnitude,// Math.pow(1.5, magnitude) * Math.pi * 2,
	strokeColor: 'white',
	strokeWeight: 1
    };
    return circle;
}

function markerClick(map, m, ifw) {
    return function() {
        // In case there's already an infoWindow open
        ifw.close(map);
        // Build html content, using data stored in the marker instance
        var infoHtml = '<strong>rowid: '+ m.rowid + '<br />log(Radiation): ' + m.prob
        infoHtml += '</strong><br />' + m.position.toString() + "</p>";

        // Standard infoWindow initialization steps
        infoWindow.setContent(infoHtml);
        infoWindow.setPosition(m.position);
        infoWindow.open(map);
    };
}

function chooseColor(prop, result) {
    if (result >= (1 - prop) && result <= (1 + prop)) {
	return 'http://labs.google.com/ridefinder/images/mm_20_green.png';
    }
    
    if (result > (1 + prop)) {
	return 'http://labs.google.com/ridefinder/images/mm_20_blue.png';
    }
    
    if (result < (1 - prop)) {
	return 'http://labs.google.com/ridefinder/images/mm_20_red.png';
    }   
}

//demoinit();
google.maps.event.addDomListener(window, 'load', demoinit);
