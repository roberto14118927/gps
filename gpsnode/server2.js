/*var express = require ('express'); 
var app = express (); 
var server = require ('http'). Servidor (aplicación); 
var io = require ('socket.io') (servidor, {orígenes: 'midominio.com: * http://midominio.com : * http://www.midominio.com:*'} );

server.listen ([PORT NUMBER], [IP], function () { 
console.log ("Servidor en funcionamiento ..."); 
});*/


var express = require('express');
var app = express();
app.use(function(req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "X-Requested-With");
        res.header("Access-Control-Allow- Headers", "Content-Type");
        res.header("Access-Control-Allow-Methods", "PUT, GET, POST, DELETE, OPTIONS");
        next();
    });
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

var sockets = [];
var web_sockets = [];

var conmysql= mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "gpsdb"
});



io.on('connection', function(socket) {
      web_sockets.push(socket)
      
    socket.on('disconnect', function() {

    var idx = web_sockets.indexOf(socket);
    if (idx != -1) {
      //console.log(idx);
      web_sockets.splice(idx, 1);
    }

  });
});


io.on('error',function(err){ 
  console.error(err)
});

server.listen(PORT, function(){
  console.log("Servidor corriendo puerto " + PORT)
});

net.createServer(function(sock) {
    console.log('CONNECTED: ' + sock.remoteAddress +':'+ sock.remotePort);    
    sock.on('data', function(data) {
        console.log("ACTIVO " + Object.keys(sockets).length); 
          
          var MAC = '5C:CF:7F:83:B3:7E';
          sockets[MAC] = sock;
      if (sockets[MAC]) {
        try {
          sockets[MAC].write("Roberto Eduardo Guzman Ruiz");
        } catch (err) {
          console.log("Error en la comunicacion. Intente de nuevo");
          //io.emit("quitar-load", "Error en la comunicacion. Intente de nuevo");
        }
      } else {
        console.log("El dispositivo no esta en linea");
        //io.emit("quitar-load", "El dispositivo no esta en linea");
      }

    });

    sock.on('end', function() {
        var idx = sockets.indexOf(sock);
        if (idx != -1) {
          sockets.splice(idx, 1);
        }
        console.log("..");
        console.log("Inactivo(" + sockets.length + ")");
    });



    /*sock.on('close', function(data) {
        console.log('CLOSED: ' + sock.remoteAddress +' '+ sock.remotePort);
    });*/
}).listen(PORT, HOST);




