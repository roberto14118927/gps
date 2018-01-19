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
var PORT = 3333;
server.listen(5678);
var arr;
var arr1;
var global_imei="";

var esp_sockets = [];
var web_sockets = [];

var MACIN = "";

var conmysql= mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "root",
  database: "gpsdb"
});



io.on('connection', function(socket) {
    //web_sockets.push(socket)
    socket.on('send-data', function(data) {
        var MAC = '5C:CF:7F:83:B3:7E';
        if (esp_sockets[MAC]) {
            try {
              esp_sockets[MAC].write("Roberto Eduardo Guzman Ruiz");
              console.log("Enviado")
            } catch (err) {
              console.log("Error Envio");
              } 
        }else {
          console.log("El dispositivo inactivo");
        }
    });
      
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
});


io.on('error',function(err){ 
  console.error(err)
});



server.listen(PORT, function(){
  console.log("Servidor corriendo puerto: " + PORT)
});



net.createServer(function(sock) {
    console.log('CONNECTED: ' + sock.remoteAddress +':'+ sock.remotePort);   

    sock.on('data', function(data) {
        //console.log(data.toString());
        /*MACIN = data.toString(); 
        console.log(MACIN);
        esp_sockets['5C:CF:7F:83:B3:7E'] = sock;
        Object.keys(esp_sockets).length;*/
        Guardamac(data.toString(),sock)  
        Object.keys(esp_sockets).length;
    });

    
    sock.on('end', function() {
        var idx = esp_sockets.indexOf(sock);
        if (idx != -1) {
          esp_sockets.splice(idx, 1);
        }
    });

    sock.on('close', function(data) {
        console.log("close");
    });
    sock.on('timeout', function(data) {
        console.log("timeout");
    });

}).listen(PORT, HOST);

function Guardamac(mac, sock){
    esp_sockets[mac] = sock
}


/*
events.js:183 
throw er; // Unhandled 'error' event       
^  Error: read ECONNRESET     
at _errnoException (util.js:1024:11)     
at TCP.onread (net.js:615:25)

se soluciona aplicando este comando
npm install ws@3.3.2 --save-dev --save-exact
*/




