var URL = 'http://192.168.1.71:5678';
 var socket = io.connect(URL, {'forceNew': true
		});

  socket.on('inicio', function(data){
  	initMap(16.768099,-93.0854785,11);
  });

  socket.on('datosgps', function(data){
    //render(data);
    //console.log(data);
    initMap(data.latit,data.longi,data.zoom);
    render(data);
  });

  function render (data) {
  /*var html = `<div>
              <strong>Latitud</strong>:
              <em>${data.latit}</em>
            </div>
            <div>
              <strong>Longitud</strong>:
              <em>${data.longi}</em>
            </div>`;*/
  var html = `<h11>LATITUD: ${data.latit}</h11> <br/> <h11>LONGITUD: ${data.longi} </h11>`;
  document.getElementById('datos').innerHTML = html;
}


  