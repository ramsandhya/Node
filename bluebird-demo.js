// Without Promises:

var fs = require('fs');
// var bodyParser = require('body-Parser');
var Promise = require('bluebird');
Promise.promisifyAll(fs);
fs.readFile('./data3 .json', function(err, data){
  if(err){
    console.log("unable to read file");
  }
  else {
    try {
      data = JSON.parse(data)
      console.log(data.name);
    } catch (e) {
      console.log("invalid json file");
    }
  }
});


// Different errors when the json file location changes.

// fs.readFile('./data1 .json', function(err, data){
// $ node bluebird-demo.js
// John
//
// fs.readFile('./data2 .json', function(err, data){
// $ node bluebird-demo.js
// invalid json file
//
// fs.readFile('./data3 .json', function(err, data){
// $ node bluebird-demo.js
// unable to read file

// With Promises:

  // var fs = require('fs');
  // // var bodyParser = require('body-Parser');
  // var Promise = require('bluebird');
  //
  // Promise.promisifyAll(fs);

fs.readFileAsync('./data1 .json')
  .then(JSON.parse)
  .then(function(val) {
    console.log(val);
  })
  .catch(SyntaxError, function(e) {
    console.log("Invalid json in file");
  })
  .catch(function(e) {
    console.log("unable to read file");
  });
