var express = require('express');
var cors = require('cors');
var bcrypt = require('bcrypt-as-promised');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var randtoken = require('rand-token');
var Promise = require('bluebird');
var stripe = require('stripe')('sk_test_21GqyNJXaHJvtsAXM5ajuM9k');

mongoose.Promise = Promise; // use bluebird with mongoose

var app = express();
app.set('port', (process.env.PORT || 8000));

app.use(express.static(__dirname + '/frontend'));

// app.get('/', function(req, res){
//     res.sendfile('index.html', { root: __dirname + "/frontend" } );
// });

// connect to the database
mongoose.connect(process.env.MONGODB_URI);

// mongodb model for users
var User = mongoose.model('User', {
  _id: { type: String, required: true },
  password: { type: String, required: true },
  authenticationTokens: [{ token: String, expiration: Date }],
  orders: [{
    "options": {
      "grind": { type: String, required: true },
      "quantity": { type: Number, required: true }
    },
    "address": {
      "name": { type: String, required: true },
      "address": { type: String, required: true },
      "address2": String,
      "city": { type: String, required: true },
      "state": { type: String, required: true },
      "zipCode": { type: String, required: true },
      "deliveryDate": { type: Date, required: true }
    }
  }]
});

// use body parser with JSON
app.use(bodyParser.json());

// use cors
app.use(cors());

// list all available grind options
app.get('/options', function(req, res) {
  res.json([
    "Extra coarse",
  	"Coarse",
  	"Medium-coarse",
  	"Medium",
  	"Medium-fine",
  	"Fine",
  	"Extra fine"
  ]);
});

// handle signups
app.post('/signup', function(req, res) {
  var username = req.body.username;
  var password = req.body.password;
  bcrypt.hash(password, 10)
    .then(function(encryptedPassword) {
      return [encryptedPassword, User.findOne({ _id: username })];
    })
    .spread(function(encryptedPassword, user) {
      if (!user) {
        // create user
        return User.create({
          _id: username,
          password: encryptedPassword
        });
      } else {
        // user already exists, throw error with 409 status code
        var error = new Error("Username is taken!");
        error.statusCode = 409;
        throw error;
      }
    })
    .then(function() {
      //successfully created user, respond with ok
      res.status(200).json({ "status": "ok" });
    })
    .catch(function(err) {
      if (!err.statusCode) {
        err.statusCode = 400;
      }
      res.status(err.statusCode).json({ "status": "fail", "message": err.message });
    });
});

// handle login
app.post('/login', function(req, res) {
  var username = req.body.username;
  var password = req.body.password;

  // find user in database
  User.findOne({ _id: username })
    .then(function(user) {
      // if user isn't found
      if (!user) {
        throw new Error("User not found");
      } else {
        // compare submitted password with encrypted password in database
        return [user, bcrypt.compare(password, user.password)];
      }
    })
    .spread(function(user, matched) {
      // return token in response body
      if (matched) {
        var token = randtoken.generate(64);
        // set token to expire in 10 days and push to authenticationTokens array
        user.authenticationTokens.push({ token: token, expiration:  Date.now() + 1000 * 60 * 60 * 24 * 10 });
        // save user's new token
        /*
          changing to return user.save() which will go to the next .then()
          throw error which will be caught by .catch() if incorrect password
        */
        return [token, user.save()];
      } else {
        // incorrect password, throw error
        throw new Error("Incorrect password!");
      }
    })
    .spread(function(token) {
      res.status(200).json({ "status": "ok", "token": token });
    })
    .catch(bcrypt.MISMATCH_ERROR, function() {
      console.log('IN MISMATCH_ERROR catch...');
      res.status(400).json({ "status": "fail", "message": "Invalid password" });
    })
    .catch(function(err) {
      console.error(err.stack);
      res.status(400).json({ "status": "fail", "message": err.message });
    });
});

// allows users to order coffee, charges purchases with stripe
app.post('/orders', authRequired, function(req, res) {
  // user is authenticated
  // push the order from the request to orders property on the user object
  // req.user is set in authRequired
  var user = req.user;

  //format order in order to save to the database
  var deliveryDate = new Date(req.body.order.date);
  var order = {
    "options": {
      "quantity": req.body.order.quantity,
      "grind": req.body.order.grindType
    },
    "address": {
      "name": req.body.order.fullname,
      "address": req.body.order.address1,
      "address2": req.body.order.address2,
      "city": req.body.order.city,
      "state": req.body.order.state,
      "zipCode": req.body.order.zipcode,
      "deliveryDate": req.body.order.date
    }
  };
  //push order to user object
  user.orders.push(order);
  //save the user to the database
  user.save()
    .then(function() {
      res.status(200).json({ "status": "ok" });
      return null;
    })
    .catch(function(err) {
      // construct a more readable error message
      var errorMessage = "";
      for (var key in err.errors) {
        errorMessage += err.errors[key].message + " ";
      }
      res.status(400).json({ "status": "fail", "message": errorMessage, "order": order });
    });
});

// process payment with stripe
app.post('/charge', function(req, res) {
  var amount = req.body.amount;
  var token = req.body.token;

  stripe.charges.create({
    amount: amount,
    currency: "usd",
    source: token
  }, function (err, charge) {
    if(err){
      res.json({
        status: "fail",
        error: err.message
      });
      return;
    }
    res.json({status: "ok", charge: charge});
  });
});

// returns all orders the user has previously submitted
app.get('/orders', authRequired, function(req, res) {
  // user is authenticated
  // respond with an object of all their order history
  var orders = [];
  var user = req.user;
  user.orders.forEach(function(order) {
    orders.push({ "options": order.options, "address": order.address });
  });
  res.status(200).json({ "status": "ok", "message": orders});
});

// function to handle authentication
function authRequired(req, res, next) {
  // assign token variable depending on if it's a GET or POST
  var token = req.query.token ? req.query.token : req.body.token;
  User.findOne(
    //check if token exists and hasn't expired
    { authenticationTokens: { $elemMatch: { token: token, expiration: { $gt: Date.now() } } } })
    .then(function(user) {
      if (user) {
        req.user = user;
        next();
      } else {
        res.status(400).json({ "status": "fail", "message": "Session expired. Please sign in again." });
      }
      return null;
    })
    .catch(function(err) {
      //if there was an error finding the user by authenticationToken
      res.status(400).json({ "status": "fail", "message": err.errors });
    });
}

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});
