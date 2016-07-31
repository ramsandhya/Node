var express = require('express');
var fs = require('fs');
var app = express();

// reading dynamic files so get() function is used. Lynda used use(). I tried with get() and it works. Need to read..
app.get('/message', function(req, res) {
    console.log('user requested endpoint');
    res.send('hello world');
});

app.get('/users', function(req, res) {
  fs.readFile('./data1.json','utf-8', function(err, data){
    res.send(data);
  });
});

app.listen(5000);
