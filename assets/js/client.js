var URL = 'http://10.10.2.96:5678';
var imei_global = "00000000000";

 var socket = io.connect(URL, {'forceNew': true
		});
  socket.on('datosgps', function(data){
    
    if(data.imei == imei_global){
      call_imei(data.imei);
       //initMap(data.latit,data.longi,data.zoom);
       //render(data);
    }
  });

function render (data) {
  var html = `<h11>LATITUD: ${data.latit}</h11> 
              <br/> 
              <br/> 
              <h11>LONGITUD: ${data.longi} </h11>
              <br/> 
              <br/> 
              <h11>FECHA: '+ fecha +' </h11>
              <br/> 
              <br/> 
              <h11>HORA: '+ hora +' </h11>
              <br/> 
              <br/> 
              <h11>COMBUSTIBLE: '+data[0].fields.combu+' </h11>
              <br/> 
              <br/> 
              <h11>ACTIVO: '+tiempo+' </h11>
              `;
  document.getElementById('datos').innerHTML = html;
}

function sendimei(imei_client){
  imei_global = imei_client;
  var sendData = {
    'imei': imei_client
  };
  socket.emit('send-data', sendData);
}





  