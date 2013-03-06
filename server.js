(function() {
  var app, currentImg, drone, express, faye, imageSendingPaused, path, server, socket;
  var keys = require('./twitterkeys');
  var Twitter = require('node-twitter');
  var fs = require('fs-extra');
  express = require("express");
  faye = require("faye");
  path = require("path");
  drone = require("ar-drone").createClient();
  drone.config('general:navdata_demo', 'TRUE');
  app = express();
  app.configure(function() {
    app.set('port', process.env.PORT || 3001);
    app.use(app.router);
    app.use(express.static(path.join(__dirname, 'public')));
    return app.use("/components", express.static(path.join(__dirname, 'components')));
  });
  
  server = require("http").createServer(app);
  
  new faye.NodeAdapter({
    mount: '/faye',
    timeout: 45
  }).attach(server);
  
  socket = new faye.Client("http://localhost:" + (app.get("port")) + "/faye");
  
  socket.subscribe("/drone/move", function(cmd) {
    var _name;
    console.log("move", cmd);
    return typeof drone[_name = cmd.action] === "function" ? drone[_name](cmd.speed) : void 0;
  });
  
  socket.subscribe("/drone/animate", function(cmd) {
    console.log('animate', cmd);
    return drone.animate(cmd.action, cmd.duration);
  });
  
  socket.subscribe("/drone/drone", function(cmd) {
    var _name;
    console.log('drone command: ', cmd);
    return typeof drone[_name = cmd.action] === "function" ? drone[_name]() : void 0;
  });

  socket.subscribe("/drone/tweet", function(cmd) {
    var _name;
    console.log('drone command: ', cmd);
    
    var text = cmd.text;
    if (text == '') {
      text = "Check out the view from the iSL Ops Copter!";
    }
        
    // Save current frame to the file system if we have one
    if (currentImg == null) {
      fs.copy('./public/default.png', 'image.png', function (err) {
        console.log("No current image, using default image.");
        if (err) {
          console.log(error);
          return;
        }
        sendTweet(text);
      });
    } else {
      fs.writeFile('image.png', currentImg, function (err) {
        if (err) {
          console.log(err);
          return;
        }
        console.log('Image saved to local disk');
        sendTweet(text);
      });
    }
    
    return typeof drone[_name = cmd.action] === "function" ? drone[_name]() : void 0;
  });
  
  var sendTweet = function (text) {
    // Init twitter client
    var twitterRestClient = new Twitter.RestClient(
        keys.consumerKey,
        keys.consumerSecret,
        keys.token,
        keys.secret
    );
    
    // Send a status with new image
    twitterRestClient.statusesUpdateWithMedia(
        {
            'status': text + Date.now(),
            'media[]': 'image.png'
        },
        function(error, result) {
            if (error) {
                console.log('Error: ' + (error.code ? error.code + ' ' + error.message : error.message));
            }

            if (result) {
                console.log("Tweet posted successfully");
            }
        }
    );
  }
  
  server.listen(app.get("port"), function() {
    return console.log("Express server listening on port " + app.get("port"));
  });
  
  currentImg = null;
  drone.on('navdata', function(data) {
    return socket.publish("/drone/navdata", data);
  });
  
  imageSendingPaused = false;
  drone.createPngStream().on("data", function(frame) {
    currentImg = frame;
    if (imageSendingPaused) {
      return;
    }
    socket.publish("/drone/image", "/image/" + (Math.random()));
    imageSendingPaused = true;
    return setTimeout((function() {
      return imageSendingPaused = false;
    }), 100);
  });
  
  app.get("/image/:id", function(req, res) {
    res.writeHead(200, {
      "Content-Type": "image/png"
    });
    return res.end(currentImg, "binary");
  });
}).call(this);
