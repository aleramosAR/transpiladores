import { Router } from "express";
import { Socket } from "socket.io";

const express = require('express');
const app = express();
const nodefetch = require('node-fetch');
const handlebars = require('express-handlebars');
const promises = require('fs').promises;
const httpServer = require('http').Server(app);
const io = require('socket.io')(httpServer);

declare namespace ExpressProd {
  interface Request { body: string; }
  interface Response { status: any; json: any; }
}

declare namespace ExpressFront {
  interface Request { body: string; }
  interface Response { render: any; json: any; }
}

interface Producto { title: string, price: string, thumbnail: string, id: number }
interface Mensaje { usuario: string, texto: string, fecha: string }

const PORT:number = 8080;

const PRODUCTS_DB:Array<Producto> = [];
let prodID:number = 0;
const MENSAJES_DB:Array<Mensaje> = [];
const mensajesLogFile:string = 'public/mensajes.log';

app.use(express.static("public"));

const frontRoutes:Router = express.Router();
const prodRoutes:Router = express.Router();
prodRoutes.use(express.json());

// Cargo el listado de productos, devuelvo un mensajes si el listado esta vacio (devuelve false)
prodRoutes.get("/", (req: ExpressProd.Request, res:ExpressProd.Response) => {
  if (!getProds()) {
    return res.status(404).json({
      error: "No hay productos cargados.",
    });
  }
  res.json(getProds());
});

// Agrego un producto
prodRoutes.post("/", (req: ExpressProd.Request, res:ExpressProd.Response) => {
  const product = req.body;
  if (addProd(product)) {
    res.status(201).json(product);
  }
  res.status(400).send();
});

// Ruta para cargar HTML enviando los productos cargados
frontRoutes.get("/", (req: ExpressFront.Request, res:ExpressFront.Response) => {
  nodefetch('http://localhost:8080/api/productos').then((res:ExpressFront.Response) => res.json()).then(function(data:Array<Producto>) {
    res.render("index", { productos: data });
  });
});


// Funcion que carga los productos y emite el llamado a "listProducts"
function getProducts() {
	nodefetch("http://localhost:8080/api/productos")
	.then((res:ExpressProd.Response) => res.json())
	.then(function (data:Array<Producto>) {
		io.sockets.emit("listProducts", data);
	});
};

// Funcion que devuelve el listado de mensajes
function getMensajes() {
	io.sockets.emit("listMensajes", MENSAJES_DB);
};

async function guardarMensajes(mensajes:Array<Mensaje>) {
	try {
		await promises.writeFile(mensajesLogFile, JSON.stringify(mensajes, null, "\t"));
	} catch(err) {
		console.log(err);
	}
}

io.on("connection", (socket:Socket) => {
	console.log("Nuevo cliente conectado!");
	getProducts();
	getMensajes();

	/* Escucho los mensajes enviado por el cliente y se los propago a todos */
	socket.on("postProduct", () => {
		getProducts();
	}).on("postMensaje", (data:Mensaje) => {
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
.on("error", (error?:string) => console.log(`Hubo un error inicializando el servidor: ${error}`) );

// Devuevo el listado completo, si el listado esta vacio devuelvo false para hacer el chequeo
function getProds() {
  if (PRODUCTS_DB.length == 0) {
    return false;
  }
  return PRODUCTS_DB;
}

// Agrego un producto al listado
function addProd(data:any) {
  if (data.title === "" || typeof data.title === "undefined") return false;
  if (data.price === "" || typeof data.price === "undefined") return false;
  if (data.thumbnail === "" || typeof data.thumbnail === "undefined") return false;
  data.id = prodID++;

  const newProduct:Producto = {
    title: data.title,
    price: data.price,
    thumbnail: data.thumbnail,
    id: data.id
  };
  PRODUCTS_DB.push(newProduct);
  return true;
}
