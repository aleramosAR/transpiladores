require("@babel/polyfill");
const regeneratorRuntime = require("regenerator-runtime");
const express = require('express');
const app = express();
const nodefetch = require('node-fetch');
const handlebars = require('express-handlebars');
const promises = require('fs').promises;
const httpServer = require('http').Server(app);
const io = require('socket.io')(httpServer);

const PORT = 8080;

const PRODUCTS_DB = [];
let prodID = 0;
const MENSAJES_DB = [];
const mensajesLogFile = 'public/mensajes.log';

app.use(express.static("public"));

const frontRoutes = express.Router();
const prodRoutes = express.Router();
prodRoutes.use(express.json());

// Cargo el listado de productos, devuelvo un mensajes si el listado esta vacio (devuelve false)
prodRoutes.get("/", (req, res) => {
  if (!getProds()) {
    return res.status(404).json({
      error: "No hay productos cargados.",
    });
  }
  res.json(getProds());
});

// Agrego un producto
prodRoutes.post("/", (req, res) => {
  const product = req.body;
  if (addProd(product)) {
    res.status(201).json(product);
  }
  res.status(400).send();
});

// Ruta para cargar HTML enviando los productos cargados
frontRoutes.get("/", (req, res) => {
  nodefetch('http://localhost:8080/api/productos').then((res) => res.json()).then(function(data) {
    res.render("index", { productos: data });
  });
});


function guardarMensajes(mensajes) {
  (async function() {
    try {
      await promises.writeFile(mensajesLogFile, JSON.stringify(mensajes, null, "\t"));
    } catch(err) {
      console.log(err);
    }
  })();
};


// Funcion que carga los productos y emite el llamado a "listProducts"
function getProducts() {
	nodefetch("http://localhost:8080/api/productos")
	.then((res) => res.json())
	.then(function (data) {
		io.sockets.emit("listProducts", data);
	});
};

// Funcion que devuelve el listado de mensajes
function getMensajes() {
	io.sockets.emit("listMensajes", MENSAJES_DB);
};

io.on("connection", (socket) => {
	console.log("Nuevo cliente conectado!");
	getProducts();
	getMensajes();

	/* Escucho los mensajes enviado por el cliente y se los propago a todos */
	socket.on("postProduct", () => {
		getProducts();
	}).on("postMensaje", (data) => {
		MENSAJES_DB.push(data);
		guardarMensajes(MENSAJES_DB);
		getMensajes();
	}).on('disconnect', () => {
		console.log('Usuario desconectado')
	});
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/", frontRoutes);
app.use("/api/productos", prodRoutes);

app.engine("hbs", handlebars({
    extname: "hbs",
    defaultLayout: "layout.hbs"
  })
);

app.set("views", "./views");
app.set("view engine", "hbs");

// Conexion a server con callback avisando de conexion exitosa
httpServer.listen(PORT, () => { console.log(`Ya me conecte al puerto ${PORT}.`); })
.on("error", error => console.log(`Hubo un error inicializando el servidor: ${error}`) );

// Devuevo el listado completo, si el listado esta vacio devuelvo false para hacer el chequeo
function getProds() {
  if (PRODUCTS_DB.length == 0) {
    return false;
  }
  return PRODUCTS_DB;
}

// Agrego un producto al listado
function addProd(data) {
  if (data.title === "" || typeof data.title === "undefined") return false;
  if (data.price === "" || typeof data.price === "undefined") return false;
  if (data.thumbnail === "" || typeof data.thumbnail === "undefined") return false;
  data.id = prodID++;

  PRODUCTS_DB.push({
    title: data.title,
    price: data.price,
    thumbnail: data.thumbnail,
    id: data.id
  });
  return true;
}