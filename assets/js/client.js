var URL = 'http://192.168.1.71:5678';
 var socket = io.connect(URL, {'forceNew': true
		});

  socket.on('inicio', function(data){
  	initMap(16.768099,-93.0854785,11);
  });

  socket.on('datosgps', function(data){
    //render(data);
    console.log(data);
    initMap(data.latit,data.longi,data.zoom);
  });

  function render (data) {
  var html = `<div>
              <strong>Latitud</strong>:
              <em>${data.latit}</em>
            </div>
            <div>
              <strong>Longitud</strong>:
              <em>${data.longi}</em>
            </div>`;

  document.getElementById('coordenadas').innerHTML = html;
}


  