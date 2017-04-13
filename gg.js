$.getJSON('https://www.highcharts.com/samples/data/jsonp.php?filename=usdeur.json&callback=?', function (data) {

    var year = new Date(data[data.length - 1][0]).getFullYear(); // Get year of last data point

    // Create the chart
    Highcharts.stockChart('highchart_test', {
        chart: {
            backgroundColor: {
                linearGradient: { x1: 0, y1: 0, x2: 1, y2: 1 },
                stops: [
                    [0, '#2a2a2b'],
                    [1, '#3e3e40']
                ]
                }
        },

        rangeSelector: {
            selected: 1
        },

        title: {
            style: {
                color: '#E0E0E3',
                textTransform: 'uppercase',
                fontSize: '20px'
            },
            text: '總進出站人次'
        },

        yAxis: {
            title: {
                text: '人次'
            }
        },

        series: [{
            name: '進出站人次',
            data: data,
            id: 'dataseries',
            tooltip: {
                valueDecimals: 4
            }
        }, ]
    });
});