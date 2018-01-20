/*var express = require ('express'); 
var app = express (); 
var server = require ('http'). Servidor (aplicación); 
var io = require ('socket.io') (servidor, {orígenes: 'midominio.com: * http://midominio.com : * http://www.midominio.com:*'} );

server.listen ([PORT NUMBER], [IP], function () { 
console.log ("Servidor en funcionamiento ..."); 
});*/


var express = require('express');
var app = express();
/*app.use(function(req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "X-Requested-With");
        res.header("Access-Control-Allow- Headers", "Content-Type");
        res.header("Access-Control-Allow-Methods", "PUT, GET, POST, DELETE, OPTIONS");
        next();
    });*/
var net = require('net');
var hex2ascii = require('hex2ascii');
var mysql = require('mysql');
var server = require('http').Server(app);
var io = require('socket.io')(server);
var os = require('os');
var conta = 0;
var interfaces = os.networkInterfaces();
var addresses = [];
for (var k in interfaces) {
  for (var k2 in interfaces[k]) {
    var address = interfaces[k][k2];
    if (address.family === 'IPv4' && !address.internal) {
      addresses.push(address.address);
    }
  }
}

app.use(express.static('static/js'))

var HOST = addresses[2];
var PORT = 3000;
server.listen(1234);
var arr;
var arr1;
var global_imei="";

var esp_sockets = [];
var web_sockets = [];

var MACIN = "";

io.on('connection', function(socket) {
    
    /*web_sockets.push(socket)  

    socket.on('disconnect', function() {
        var idx = web_sockets.indexOf(socket);
        if (idx != -1) {
          web_sockets.splice(idx, 1);
        }
    });

    socket.on('end', function() {
        
    });

    socket.on('error', function() {

    });

    socket.on('timeout', function() {
        
    });

    socket.on('close', function() {
        
    });

    socket.on('send-data', function(data) {
      sendData();
  });*/
  socket.on('send-data', function(data) {
      sendData();
  });
});


io.on('error',function(err){ 
  console.error(err)
});



server.listen(PORT, function(){
  console.log("Servidor corriendo puerto: " + PORT)
});



var ESP8266 = net.createServer(function(sock) {

    sock.on('data', function(data) {
        
        var datosin = data.toString().split(".");
        if (datosin.length == 0) {
           return;
        }
        switch (datosin[1]) {
          case "0":
              esp_sockets[datosin[0]] = sock; 
              console.log("Registro Ok");
          break;
          case "1":
              console.log("Recepcion de datos");
          break;
        } 
        console.log("DISPOSITIVOS EN LINEA: " + Object.keys(esp_sockets).length);
    });
    
    sock.on('close', function(data) {
      console.log("close");
    });
    sock.on('timeout', function(data) {
      console.log("timeout");
    });

    sock.on('end', function() {
      var idx = esp_sockets.indexOf(sock);
      if (idx != -1) {
        esp_sockets.splice(idx, 1);
      }
      console.log("");
    });

    sock.on('error', function(data) {
      console.log("error...");
    });

});

ESP8266.on('error', function(e) {
  console.log("Error: Necesario reiniciar...");
  if (e.code == 'EADDRINUSE') {
    console.log('Address in use, retrying...');
    setTimeout(function() {
      ESP8266.close();
      ESP8266.listen(PORT, PORT);
    }, 1000);
  }
});

ESP8266.listen(PORT, PORT);


//FUNCIONES*********************************
function sendData(){
  //var MAC = '5C:CF:7F:83:B3:7E';
  var MAC = '5C:CF:7F:80:E6:8B';
  if (esp_sockets[MAC]) {
      try {
          esp_sockets[MAC].write("Roberto Eduardo Guzman Ruiz");
          console.log("Enviado")
      } catch (err) {
          console.log(err);
          console.log("Error Envio");
        } 
  } 
  else {
      console.log("El dispositivo inactivo");
  }
}

 /*setTimeout(function() {
      var MAC = '5C:CF:7F:83:B3:7E ';
  if (esp_sockets[MAC]) {
      try {
          esp_sockets[MAC].write("Roberto Eduardo Guzman Ruiz");
          console.log("Enviado")
      } catch (err) {
          console.log(err);
          console.log("Error Envio");
        } 
  } 
  else {
      console.log("El dispositivo inactivo");
  }
    }, 10000);*/



/*function Guardamac(mac, sock){
    console.log(mac);
    esp_sockets['5C:CF:7F:83:B3:7E'] = sock
}*/




/*
events.js:183 
throw er; // Unhandled 'error' event       
^  Error: read ECONNRESET     
at _errnoException (util.js:1024:11)     
at TCP.onread (net.js:615:25)

se soluciona aplicando este comando
npm install ws@3.3.2 --save-dev --save-exact
*/




