var fs = require('fs');

var tomString = '{"name": "Tom"}';

fs.writeFile('tom.json', tomString);

var timmy = {"name" : "Timmy"}; 
fs.writeFile('timmy.json', JSON.stringify(timmy));
