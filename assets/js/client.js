var URL = 'http://192.168.1.69:1234';
var imei_global = "00000000000";

 var socket = io.connect(URL, {'forceNew': true
		});
  socket.on('datosgps', function(data){
    if(data.imei == imei_global){
       initMap(data.latit,data.longi,data.zoom);
       render(data);
    }
  });

function render (data) {
  var html = `<h11>LATITUD: ${data.latit}</h11> <br/> <h11>LONGITUD: ${data.longi} </h11>`;
  document.getElementById('datos').innerHTML = html;
}

function sendimei(imei_client){
  var sendData = {
    'imei': imei_client
  };
  socket.emit('send-data', sendData);
}





  