var fs = require('fs');
// var bodyParser = require('body-Parser');

fs.readFile('./data1.json', function(err, data){
  data = JSON.parse(data)
  console.log(data.name);
});
