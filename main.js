/*
*	This project is under development.
*/

var CartoDB_DarkMatter = L.tileLayer('http://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
	attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="http://cartodb.com/attributions">CartoDB</a>',
	subdomains: 'abcd',
	minZoom: 12,
	maxZoom: 17
});
//Load and initialize leaflet map. 
var map = L.map('map').setView([25.046374, 121.517896], 13);
mapLink = '<a href="http://openstreetmap.org">OpenStreetMap</a>';
CartoDB_DarkMatter.addTo(map);
map._initPathRoot();

//initialize d3
// var pie = d3.layout.pie().sort(null);
var svg = d3.select("#map").select('svg');


var colorScale = d3.scale.ordinal()
					.range(["#17becf", "#d62728"])
					.domain([0, 1]);;

var countScale = d3.scale.linear()
				.range([(50^2)*Math.PI, (1000^2)*Math.PI]);

var zoomScale = d3.scale.ordinal()
				.domain([12, 13, 14, 15, 16, 17])
				.range([1, 2, 3, 5, 8 ,10]);
var timeInputFormat = d3.time.format("%Y-%m-%d");
var timeDataFormat = d3.time.format("%Y/%m/%d");
var countFormat = d3.format([","]);

var dateInput = document.getElementById("currentDate");
//Global variables
var rawData = [];
var mrtDataset = [];
var mrtCharts;
var stationMarkerSize = 6;

var MrtStation = function(){
	this.address = "";
	this.stationId = [];
	this.line = [];
	this.line_no = [];
	this.stationType = ""; //regular, terminal, transfer
	this.lat = "";
	this.lng = "";
	this.stationName = "";
	this.zipcode = "";
	this.passengerCount = {};
	this.transferTime = 0;
};
//load and render
var loader = new MultiDataLoader(['mrt.csv', 'in.csv', 'out.csv', 'mrtTransportation.csv']);
loader.addListener('dataLoaded', function(evt){
	processData();
	initializeCharts();
});
loader.startLoading();

var processData = function(){
	var stationInfo = rawData[0];
	var passengerIn = rawData[1];
	var passengerOut = rawData[2];
	var transferInfo = rawData[3];

	var stationList = Object.keys(rawData[1][0]);
	stationList.shift(); //remove date key

	//find min and max for each day
	for(var i = 0, n = passengerIn.length; i < n; i++){
		var dailyCount = [];
		for(var j = 0, k = stationList.length; j < k; j++){
			var countString = passengerIn[i][stationList[j]];
			var count = parseInt(countString.replace(",", ""));
			dailyCount.push(count);
		}
		passengerIn[i].min = d3.min(dailyCount);		
		passengerIn[i].max = d3.max(dailyCount);		
	}

	for(var i = 0, n = passengerOut.length; i < n; i++){
		var dailyCount = [];
		for(var j = 0, k = stationList.length; j < k; j++){
			var countString = passengerOut[i][stationList[j]];
			var count = parseInt(countString.replace(",", ""));
			dailyCount.push(count);
		}
		passengerOut[i].min = d3.min(dailyCount);		
		passengerOut[i].max = d3.max(dailyCount);		
	}	

	stationList.forEach(createStationObject);
	function createStationObject(element, index, array) {
		var station = new MrtStation();
		station.stationName = element;
		mrtDataset.push(station);
	}

	mrtDataset.forEach(function(element, index, array) {
		var stationName = element.stationName;
		//
		for(var i = 0, n = stationInfo.length; i < n; i++){
			if(stationInfo[i].name == element.stationName){
				element.address = stationInfo[i].address;
				element.stationId.push(stationInfo[i].id);
				element.line.push(stationInfo[i].line);
				element.line_no.push(stationInfo[i].line_no);				
				element.lat = stationInfo[i].lat;
				element.lng = stationInfo[i].lng;
				element.zipcode = stationInfo[i].zipcode;
			}
		}
		if(element.line.length > 1){
			element.stationType = "transfer"; //regular, terminal, transfer
		}else{
			element.stationType = "regular";
		}
		//
		for(var i = 0, n = passengerIn.length; i < n; i++){			
			var count = parseInt(passengerIn[i][stationName].replace(",", ""));
			var dateRecord = timeDataFormat.parse(passengerIn[i]["日期"]);
			var dateString = timeInputFormat(dateRecord);
			if(!element.passengerCount[dateString]){
				var countObject = {
					in: count,
					out: 0
				};
				element.passengerCount[dateString] = countObject;
			}else{
				element.passengerCount[dateString].in = count;
			}
			
		}
		for(var i = 0, n = passengerOut.length; i < n; i++){			
			var count = parseInt(passengerOut[i][stationName].replace(",", ""));
			var dateRecord = timeDataFormat.parse(passengerIn[i]["日期"]);
			var dateString = timeInputFormat(dateRecord);
			if(!element.passengerCount[dateString]){
				var countObject = {
					in: 0,
					out: count
				};
				element.passengerCount[dateString] = countObject;
			}else{
				element.passengerCount[dateString].out = count;
			}
			element.passengerCount[dateString].mean = (element.passengerCount[dateString].in + element.passengerCount[dateString].out)/2;
		}
		//

		for(var j = 0, n = transferInfo.length; j < n; j++){
			var transferName = transferInfo[j].station.replace(/捷運|站/g, "");
			if(transferName == stationName){
				element.transferTime = transferInfo[j].Time;
				break;
			}
		}
		//Create LatLng object for Leaflet map	
		element.LatLng = new L.LatLng(element.lat, element.lng);
	});
}

//Rendering phase
var appendInfoBlock = function(station){
	var pos = map.latLngToLayerPoint(station.LatLng);
	var textWidth = station.stationName.length * 12;
	var currentDate = dateInput.value;
	svg.append("text")
		.attr("class", "tip")
		.text(station.stationName)
		.attr("pointer-events", "none")
		.attr("text-anchor", "middle")
		.attr("x", pos.x)
		.attr("y", pos.y + 4)
		.attr("fill", "#fff");
	var infoBlock = d3.select('#info').classed('hidden', false);
	infoBlock.selectAll("ul").remove();
	var str1 = "站名: " + station.stationName;
	var str2 = "進站人數: " + countFormat(station.passengerCount[currentDate].in);
	var str3 = "出站人數: " + countFormat(station.passengerCount[currentDate].out);
	var str4 = "捷運路線: ";
	var list = infoBlock.append("ul");
	list.append("li").html(str1);
	list.append("li").html(str2);
	list.append("li").html(str3);
	if(station.line.length > 1){
		for(var i = 0, n = station.line.length; i < n; i++){
			if(i < (n-1)){
				str4 += station.line[i] + ", ";
			}else{
				str4 += station.line[i];
			}		
		}
	}else{
		str4 += station.line[0];
	}
	list.append("li").html(str4);

};

var initializeCharts = function(){
	var currentZoom = map.getZoom();
	var currentDate = dateInput.value;
	var countDomainMin = d3.min([rawData[1][0].min, rawData[2][0].min]);
	var countDomainMax = d3.max([rawData[1][0].max, rawData[2][0].max]);
	countScale.domain([countDomainMin, countDomainMax]);
	//update scale.domain according to date
	mrtCharts = svg.selectAll('g.stationChart')
				.data(mrtDataset)
				.enter().append("g")
				.attr('class', 'stationChart')							
				.on("mouseenter", function(d){
					appendInfoBlock(d);
				})
				.on("mouseleave", function(d){
					var infoBlock = d3.select('#info').classed('hidden', true);
					svg.selectAll(".tip")
						.remove();
					svg.selectAll(".tipBackgroud")
						.remove();
				});

	mrtCharts.append('circle')
			.attr('class', 'info')						
			.attr("stroke-width", 1)	
			.attr("stroke", "#666")		
			.style("fill-opacity", 0.25) 		
			.style("fill", "#fff")
			.attr("r", function(){return zoomScale(currentZoom)*stationMarkerSize;});  			

	mrtCharts.append('circle')
				.attr('class', 'inCount')
				.attr('fill-opacity', 0)
				.attr('fill','#000')
				.attr("stroke-width", 2)
				.attr("stroke-dasharray", "1,3")				
	 			.attr("stroke", function(d){
					if(d.stationId.length > 1){
						return 'white';
					}else{
						var lineId = d.stationId[0];
						if(lineId.match(/BL/)){
							return '#398AFC';
						}
						else if(lineId.match(/BR/)){
							return '#CC9900';
						}
						else if(lineId.match(/B/)){
							return '#CC9900';
						}
						else if(lineId.match(/R/)){
							return '#FD5B56';
						}
						else if(lineId.match(/G/)){
							return '#009900';
						}
						else if(lineId.match(/O/)){
							return '#FFCC66';
						}
						else{
							return 'black';
						}
						
					}
					
				})	
				.attr("r", function(d){
					var count = d.passengerCount[currentDate].in;
					return Math.sqrt(countScale(count)/Math.PI);
				});

	mrtCharts.append('circle')
			.attr('class', 'outCount')
			.attr('fill-opacity', 0)
			.attr('fill','#fff')
			.attr("stroke-width", 2)	
			.attr("stroke-dasharray", "20,20")			
 			.attr("stroke", function(d){
				if(d.stationId.length > 1){
					return 'white';
				}else{
					var lineId = d.stationId[0];
					if(lineId.match(/BL/)){
						return '#005eb8';
					}
					else if(lineId.match(/BR/)){
						return '#9e652e';
					}
					else if(lineId.match(/B/)){
						return '#9e652e';
					}
					else if(lineId.match(/R/)){
						return '#cb2c30';
					}
					else if(lineId.match(/G/)){
						return '#007749';
					}
					else if(lineId.match(/O/)){
						return '#ffa300';
					}
					else{
						return 'black';
					}
					
				}
				
			})	
			.attr("r", function(d){
				var count = d.passengerCount[currentDate].out;
				return Math.sqrt(countScale(count)/Math.PI);
			});

	// mrtCharts = svg.selectAll('g.chart')
	// 		.data(mrtDataset)
	// 		.enter().append('g')
	// 		.attr("class", "chart")
	// 		.on("mouseenter", function(d){	
	// 		})
	// 		.on("mouseleave", function(d){
	// 		});  

	// var arcs = mrtCharts.selectAll("g.chart")
	// 			.data(function(d, i){ 
	// 				var inCount = d.passengerCount[dateInput].in;
	//  				var outCount = d.passengerCount[dateInput].out;	
	// 				return pie([inCount, outCount]); 
	// 			})
	// 			.enter()
	// 			.append("g")
	// 			.attr("class", "arc");		
	// arcs.append("path")
	// 		.attr("fill", function(d, i){
	// 			return colorScale(i);
	// 		})
	// 		.attr("stroke", "#fff")	
	// 		.attr("d", function(d, i){
	// 			var arcGenerator = d3.svg.arc()
	// 					.innerRadius(0)
	// 					.outerRadius(
	// 						Math.sqrt(countScale(d.value)/Math.PI)
	// 					);
	// 			return arcGenerator(d, i);
	// 		});

	map.on("viewreset", projectPosition);
	map.on("zoomend", updateZoom);
	
	projectPosition();
	updateZoom();
	function projectPosition(){
		mrtCharts.attr("transform", 
		function(d) { 
			return "translate("+ 
				map.latLngToLayerPoint(d.LatLng).x +","+ 
				map.latLngToLayerPoint(d.LatLng).y +")";
			}
		)
	};

	function updateZoom(){
		//console.log(map.getZoom());//accept zoom 11~17 or *10 / *0.1 when zoomed?
		var currentZoom = map.getZoom();
		if(currentZoom > 17) currentZoom = 17;
		if(currentZoom < 11) currentZoom = 11;
		var currentDate = dateInput.value;
		mrtCharts.selectAll('circle.info')
				.transition()
				.duration(500)
	    		.ease("cubic-in-out")
				.attr("r", function(d){
					return zoomScale(currentZoom)*stationMarkerSize;
				});
		mrtCharts.selectAll('circle.inCount')
				.transition()
				.duration(500)
	    		.ease("cubic-in-out")
				.attr("r", function(d){
					var count = d.passengerCount[currentDate].in;
					return zoomScale(currentZoom)*Math.sqrt(countScale(count)/Math.PI);
				});
		mrtCharts.selectAll('circle.outCount')
				.transition()
				.duration(500)
	    		.ease("cubic-in-out")
				.attr("r", function(d){
					var count = d.passengerCount[currentDate].out;
					return zoomScale(currentZoom)*Math.sqrt(countScale(count)/Math.PI);
				});
	};

};

var updateCharts = function(){
	var currentZoom = map.getZoom();
	var currentDate = dateInput.value;
	mrtCharts.selectAll('circle.inCount')
			.transition()
			.duration(500)
    		.ease("cubic-in-out")			
			.attr("r", function(d){
				var count = d.passengerCount[currentDate].in;
				return zoomScale(currentZoom)*Math.sqrt(countScale(count)/Math.PI);
			});
	mrtCharts.selectAll('circle.outCount')
			.transition()
			.duration(500)
    		.ease("cubic-in-out")
			.attr("r", function(d){
				var count = d.passengerCount[currentDate].out;
				return zoomScale(currentZoom)*Math.sqrt(countScale(count)/Math.PI);
			});
};


var autoplayDate = 1;
var autoplayInterval;
var startAutoPlay = function(evt){
	d3.select('#autoplay').classed({'hidden': true, 'button': false});
	d3.select('#stop').classed({'hidden': false, 'button': true});
	dateInput.value = "2015-04-01"
	autoplayInterval = setInterval(function() {	  
		if(autoplayDate < 10){
			var currentDate = "2015-04-0" + autoplayDate;
		}else{
			var currentDate = "2015-04-" + autoplayDate;
		}
		dateInput.value = currentDate;
		updateCharts();
		autoplayDate ++;
		if(autoplayDate > 30){
			autoplayDate = 1;
		}
	}, 1000);
};

var stopAutoPlay = function(evt){
	d3.select('#autoplay').classed({'hidden': false, 'button': true});
	d3.select('#stop').classed({'hidden': true, 'button': false});
	clearInterval(autoplayInterval);
};
