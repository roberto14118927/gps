
var express = require('express');
var app = express();
var net = require('net');
var hex2ascii = require('hex2ascii');
var mysql = require('mysql');
var server = require('http').Server(app);
var io = require('socket.io')(server);

app.use(express.static('static/js'))
const web_sockets = []
//var HOST = '192.168.1.71';'
var HOST = '192.168.1.71'
var PORT = 3000;
server.listen(5678);
var arr;
var arr1;

var conmysql= mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "gpsdb"
});



io.on('connection', function(socket) {
      web_sockets.push(socket)
      //io.emit('inicio', "messages")   
      /*socket.on('new-menssage', function(data) {
      messages.push(data);
      io.sockets.emit('datosgps', messages)       
      });*/
});

server.listen(3000, function(){
  console.log("Servidor corriendo puerto 3000")
});

net.createServer(function(sock) {
    console.log('CONNECTED: ' + sock.remoteAddress +':'+ sock.remotePort);    
    sock.on('data', function(data) {
        var str = data.toString('hex');
        var strin = hex2ascii(str);
        var dataclean = getCleanedString(strin);
        console.log(dataclean)
        arr = dataclean.toString().split(",");
        //arr1 = dataclean.toString().split(" ",20);
        //console.log(arr1);
        var veri = arr[1];
        if(veri == "verifica"){
            var imei = arr[2];
            var id_user = arr[3];
            var records1;
             inserta = [
              [id_user, imei]
            ];
              conmysql.query('INSERT INTO `gps_gpson` (`id_user`, `imei`) VALUES ? ',[inserta], function (err, result) {
                if (err) throw err;
                console.log("1 registro agregado ");
              });

        }else{
          var imei = arr[3];
          var latitud = arr[10];
          var longitud = arr[12];
          latitud = String(latitud);
          var inicio = latitud.substring(0, 2);
          var fin = latitud.substring(2, 8);
          var mm = (fin/10000);
          mm = (mm/60);
          var dd = inicio;
          var latitudgps = (parseInt(dd) + parseFloat(mm));
          latitudgps = String(latitudgps);
          latitudgps = latitudgps.substring(0, 10);
          latitudgps = latitudgps * 1
          //latitudgps = String(latitudgps);
          //--------------------------------------------------------------
          longitud = String(longitud);
          var inicio1 = longitud.substring(0, 3);
          var fin1 = longitud.substring(3, 9);
          var mm1 = (fin1/10000);
          mm1 = (mm1/60);
          var dd1 = inicio1;
          var longitudgps = (parseInt(dd1) + parseFloat(mm1));
          longitudgps = String(longitudgps);
          longitudgps = longitudgps.substring(0, 10);
          longitudgps = (longitudgps*-1);
          //longitudgps = String(longitudgps);
          //--------------------------------------------------------------
          //if(latitudgps != 0 && longitudgps!= 0) {
            io.emit('datosgps', {
            	latit:latitudgps,
            	longi:longitudgps,
              zoom:16,
              imei:imei
            });
          //}
            
        }      
    });
    
    sock.on('close', function(data) {
        console.log('CLOSED: ' + sock.remoteAddress +' '+ sock.remotePort);
    });
    
}).listen(PORT, HOST);


function getCleanedString(cadena){
   // Definimos los caracteres que queremos eliminar
   var specialChars = "!@#$^&%*()+=[]\/{}|:<>?.";

   // Los eliminamos todos
   for (var i = 0; i < specialChars.length; i++) {
       cadena= String(cadena).replace(new RegExp("\\" + specialChars[i], 'gi'), '');
   }   

   // Lo queremos devolver limpio en minusculas
   cadena = cadena.toLowerCase();

   // Quitamos espacios y los sustituimos por _ porque nos gusta mas asi
   cadena = cadena.replace(/([\ \t]+(?=[\ \t])|^\s+|\s+$)/g,',');

   // Quitamos acentos y "ñ". Fijate en que va sin comillas el primer parametro
   cadena = cadena.replace(/á/gi,"a");
   cadena = cadena.replace(/é/gi,"e");
   cadena = cadena.replace(/í/gi,"i");
   cadena = cadena.replace(/ó/gi,"o");
   cadena = cadena.replace(/ú/gi,"u");
   cadena = cadena.replace(/ñ/gi,"n");
   return cadena;
}



 /*var udpPort = 3000;
 var url = require ('url');
 var udp = require ('dgram');
 var http = require ('http');
 var request = require ('request');
 var udpServer = udp.createSocket ('udp4').bind (3000, '10.10.2.189');
 
 udpServer.on ('close', function (err) {
     console.log ("UDP close");
 });
 
 udpServer.on ('error', function (err) {
     console.log ("UDP Error: " + err.toString ());
 });
 
 udpServer.on ('message', function (data, port) {
     console.log ("UDP received");
 });
 
 udpServer.on ('listening', function () {
     var address = udpServer.address ();
     console.log ("UDP Listening On IP: " + address.address + " at Port: " + address.port);
 });

  module.exports = function (){
     this.send = function (objectID, script, action, variables){
 
     }
 }*/

/*module.exports = require('dgram');
const dgram = require('dgram');
const server = dgram.createSocket('udp4');

server.on('error', (err) => {
  console.log(`server error:\n${err.stack}`);
  server.close();
});

server.on('message', (msg, rinfo) => {
  console.log("ok");
  console.log(`server got: ${msg} from ${rinfo.address}:${rinfo.port}`);
});

server.on('listening', () => {
  const address = server.address();
  console.log(`server listening ${address.address}:${address.port}`);
});

server.bind(PORT, HOST);*/

