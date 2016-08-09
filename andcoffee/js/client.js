// define app module with ngRoute and ngCookies dependencies
var coffeeApp = angular.module('coffeeApp', ['ngRoute', 'ngCookies', 'ngMessages']);

// backend running on port 8000
var API = "https://mycoffeestore.herokuapp.com";


// define routing
coffeeApp.config(function($routeProvider) {
  $routeProvider
    .when('/', {
      controller: 'HomeController',
      templateUrl: 'home.html',
    })
    .when('/options/', {
      controller: 'OptionsController',
      templateUrl: 'options.html',
    })
    .when('/delivery', {
      controller: 'DeliveryController',
      templateUrl: 'delivery.html',
    })
    .when('/payment', {
      controller: 'PaymentController',
      templateUrl: 'payment.html',
    })
    .when('/thankyou', {
      controller: 'ThankyouController',
      templateUrl: 'thankyou.html',
    })
    .when('/login', {
      controller: 'LoginController',
      templateUrl: 'login.html',
    })
    .when('/register', {
      controller: 'RegisterController',
      templateUrl: 'register.html',
    })
    .otherwise({ redirectTo: '/'});
});

coffeeApp.run(function($rootScope, $location, $cookies) {
  // on every location change start, see where the user is attempting to go
  $rootScope.$on('$locationChangeStart', function(event, nextUrl, currentUrl) {
    // get path from url
    var path = nextUrl.split('/')[4];
    // if user is going to a restricted area and doesn't have a token stored in a cookie, redirect to the login page
    var token = $cookies.get('token');
    if (!token && (path === 'delivery' || path === 'options' || path === 'payment')) {
      $rootScope.goHere = path;
      $location.path('/login');
    }

    // is the user logged in? used to display login, logout and signup links
    $rootScope.isLoggedIn = function() {
      return $cookies.get('token');
    };

    $rootScope.logout = function() {
      $cookies.remove('token');
    };
  });
});

// service to save order data in a cookie
coffeeApp.service('OrderService', function($cookies) {
  this.saveData = function(data) {
    $cookies.put('orderdata', JSON.stringify(data));
  };
  this.getData = function() {
    try {
      return JSON.parse($cookies.get('orderdata'));
    }
    catch(e) {
      return {};
    }
  };
});


coffeeApp.controller('HomeController', function($scope, $location) {
  $scope.isActive = true;
  // directToOptions function redirect the user to /options
  $scope.directToOptions = function(){
    $location.path("/options");
  };
});

coffeeApp.controller('OptionsController', function($scope, $http, $location, OrderService) {
  $scope.isActive = true;
  // call the backend to receive a list of coffee type options
  $http.get(API + '/options')
    .then(function(response) {
      // attach the array of coffee type options to the scope
      $scope.options = response.data;
    })
    .catch(function(err) {
      console.error(err);
    });

  //save the order using OrderService
  $scope.storeOrder = function(type) {
    var data = OrderService.getData();
    if (type === 'ind') {
      data.quantity = $scope.quantityInd;
      data.grindType = $scope.grindTypeInd;
      data.frequency = $scope.frequencyInd;
      data.amount = $scope.quantityInd * 20;
    } else if (type === 'fam') {
      data.quantity = $scope.quantityFam;
      data.grindType = $scope.grindTypeFam;
      data.frequency = $scope.frequencyFam;
      data.amount = $scope.quantityFam * 20;
    }
    OrderService.saveData(data);
    $location.path("/delivery");
  };
});

coffeeApp.controller('DeliveryController', function($scope, $location, OrderService) {
  $scope.processDeliveryInfo = function() {
    var data = OrderService.getData();
    data.fullname = $scope.fullname;
    data.address1 = $scope.address1;
    if ($scope.address2 === undefined) {
      $scope.address2 = "N/A";
    }
    data.address2 = $scope.address2;
    data.city = $scope.city;
    data.state = $scope.state;
    data.zipcode = $scope.zipcode;
    data.date = $scope.date;

    //save order data to cookie with OrderService
    OrderService.saveData(data);
    // redirect to payment page
    $location.path("/payment");
  };
});

coffeeApp.controller('PaymentController', function($scope, $http, $location, $cookies, OrderService) {
  // attach current order information to scope
  var order = OrderService.getData();
  $scope.order = order;
  var amount = order.amount * 100;
  var userToken = $cookies.get('token');

  $scope.processPayment = function() {
    // stripe
    // Creates a CC handler which could be reused.
    var handler = StripeCheckout.configure({
      // my testing public publishable key
      key: 'pk_test_kRwESRwnQ8TEmXsuiOIRyHgP',
      locale: 'auto',
      // once the credit card is validated, this function will be called
      token: function(token) {
        // Make the request to the backend to actually make a charge
        // This is the token representing the validated credit card
        var tokenId = token.id;
        $http.post(API + '/charge', { amount: amount, token: tokenId })
          .then(function(data) {
            console.log('Charge:', data);
            // alert('You were charged $' + (data.data.charge.amount / 100));
            $location.path('/thankyou');
          })
          .catch(function(err) {
            //alert user of error
          });
      }
    });
    // open the handler - this will open a dialog
    // with a form with it to prompt for credit card
    // information from the user
    handler.open({
      name: 'DC Roasters',
      description: 'Pay via Stripe...',
      amount: amount
    });

    //save order to the database
    $http.post(API + '/orders', { order: order, token: userToken })
      .then(function(response) {
        //do nothing
      })
      .catch(function(err) {
        //handle error
        console.log(err);
      });
  };
});

coffeeApp.controller('LoginController', function($scope, $http, $location, $rootScope, $cookies) {
  $scope.login = function() {
    if ($scope.loginForm.$valid) {
      $http.post(API + '/login', { username: $scope.username, password: $scope.password })
        .then(function(response) {
          // if login is a success, redirect
          if (response.status === 200) {
            $scope.loginFailed = false;
            // set a cookie with the token from the database response
            $cookies.put('token', response.data.token);
            // redirect to the page they were trying to go to
            $location.path('/' + $rootScope.goHere);
          }
        })
        .catch(function(err) {
          // tell user login wasn't successful
          $scope.loginFailed = true;
        });
    }
  };
  $scope.registration = function(){
    $location.path("/register");
  };
});


coffeeApp.controller("ThankyouController", function($location, $scope){
  // Redirecting the customer to options page
  $scope.directToOptions = function(){
    $location.path("/options");
  };
});

coffeeApp.controller('RegisterController', function($scope, $location, $http) {
  $scope.register = function() {
    $http.post(API + '/signup', { username: $scope.username, password: $scope.password })
      .then(function(response) {
        if (response.status === 200) {
          // user successfully created
          $scope.registered = true;
        }
      })
      .catch(function(err) {
        console.log(err);
      });
  };

  // if they've registered and clicked the login button, redirect to the login page
  $scope.redirectToLogin = function() {
    $location.path('/login');
  };
});
