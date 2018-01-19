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
  password: "root",
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
        var str = data.toString('hex');
        var strin = hex2ascii(str);
        var dataclean = getCleanedString(strin);
        console.log(dataclean)
        arr = dataclean.toString().split(",");
        var veri = arr[1];
        if (typeof arr[3] !== null) {
            if(veri == "verifica"){
                var imei = arr[2];
                var id_user = arr[3];
                var records1;
                 inserta = [
                  [imei, id_user]
                ];
                  conmysql.query('INSERT INTO `gps_gpson` (`imei`,`id_user_id`) VALUES ? ',[inserta], function (err, result) {
                    if (err) throw err;
                    console.log("1 registro agregado ");
                  });

            }else{
              var imei = arr[2];
              imei = imei.replace(" ", "");
              var latitud = arr[9];
              var longitud = arr[11];
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
              insertaubi = [
                  [String(imei), String(latitudgps), String(longitudgps), 0]
              ];    
              conmysql.query('INSERT INTO `gps_gpsub` (`imei`, `latit`, `longi`, `combu`) VALUES ? ',[insertaubi], function (err, result) {
                 if (err) throw err;
               });  
                  io.emit('datosgps', {
                        latit:latitudgps,
                        longi:longitudgps,
                        zoom:17,
                        imei:imei
                  });            
            }
        }

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


