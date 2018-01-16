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
const shortid = require('shortid');
var hex2ascii = require('hex2ascii');
var mysql = require('mysql');
var serverio = require('http').Server(app);
var io = require('socket.io')(serverio);
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
var PORT = 3000;
const ubica_sockets = []
const clients = new Map()
serverio.listen(5678);
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

const server = net.createServer()
server.listen(PORT, HOST);

io.on('connection', function(socket) {
      
      web_sockets.push(socket)

      socket.on('ping', function(data) {
        
      });

    
      socket.on('disconnect', function() {

      });
});




server.on('connection', function(sock) {
    sock.setEncoding('utf8')
    sock.id = shortid.generate();
    sock.dispositivo = "";
    ubica_sockets[sock.id] = sock;
    clients.set(sock.id, sock)
    console.log(" ");
    console.log('CONNECTED: ' + sock.remoteAddress + ':' + sock.remotePort + ': ID: ' + sock.id);
    var respuesta = "1," + sock.id;
    sock.write(respuesta);

    server.getConnections(function(err, count) {
        console.log("Connections:: " + count);
    });


    sock.on('data', function(data) {
        //analizarDatos(data.toString(), sock);
        //const payload = parsePayload(data)
        //console.log(payload);
    });

    sock.on('end', function() {
        console.log('END: ' + sock.remoteAddress + ':' + sock.remotePort + ': ID: ' + sock.id);
        delete ubica_sockets[sock.id]
        clients.delete(sock.id)
        console.log("Connections.: " + Object.keys(ubica_sockets).length);
    });

    sock.on('error', function() {
        console.log('ERROR: ' + sock.remoteAddress + ':' + sock.remotePort + ': ID: ' + sock.id);
        delete ubica_sockets[sock.id]
        clients.delete(sock.id)
        console.log("Connections.: " + Object.keys(ubica_sockets).length);
    });

    sock.on('timeout', function() {
        console.log('TIMEOUT: ' + sock.remoteAddress + ':' + sock.remotePort + ': ID: ' + sock.id);
        delete ubica_sockets[sock.id]
        clients.delete(sock.id)
        console.log("Connections.: " + Object.keys(ubica_sockets).length);
    });

    sock.on('close', function() {
        console.log('CLOSE: ' + sock.remoteAddress + ':' + sock.remotePort + ': ID: ' + sock.id);
        delete ubica_sockets[sock.id]
        clients.delete(sock.id)
        console.log("Connections.: " + Object.keys(ubica_sockets).length);
    });

});




