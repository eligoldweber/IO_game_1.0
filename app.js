//var mongojs = require("mongojs");
//var db = mongo
var express = require('express');
var app = express();
var serv = require('http').Server(app);

app.get('/',function(req,res){
	res.sendFile(__dirname + '/client/index.html');
});
app.use('/client',express.static(__dirname + '/client'));
serv.listen(process.env.PORT || 2000);


console.log("hello world -- started");

var SOCKET_LIST = {};

var Entity = function(id){
	var self = {
		x:250,
		y:250,
		spdX:0,
		spdY:0,
		id:"",
	}
	self.update = function(){
		self.updatePosition();
	}
	self.updatePosition = function(){
		self.x += self.spdX;
		self.y += self.spdY;
	}
	self.getDistance = function(pt){
		return Math.sqrt(Math.pow(((self.x)-(pt.x)),2)+ Math.pow(((self.y)-(pt.y)),2));
	}
	return self;
}

var Player = function(id,name){
	var self = Entity();
	self.number = "" + Math.floor(10*Math.random());
	self.id = id;
	self.pressingRight = false;
	self.pressingLeft = false;
	self.pressingUp = false;
	self.pressingDown = false;
	self.pressingAttack = false;
	self.mouseAngle = 0;
	self.maxSpd = 10;
	self.name = name;
	
	var super_update = self.update;
	self.update = function(){
		self.updateSpd();
		super_update();
		
		if(self.pressingAttack){
			for(var i = -3; i<3;i++)
				self.shootBullet(i * 10 + self.mouseAngle);
		}

	}
	self.shootBullet = function(angle){
		var b = Bullet(self.id, angle); 
		b.x = self.x;
		b.y = self.y;
	}

	self.updateSpd = function(){
		if(self.pressingRight)
			self.spdX = self.maxSpd;
		else if(self.pressingLeft)
			self.spdX = -self.maxSpd;
		else
			self.spdX = 0;
		
		if(self.pressingUp)
			self.spdY = -self.maxSpd;
		else if(self.pressingDown)
			self.spdY = self.maxSpd;
		else
			self.spdY = 0;
		
	}
	Player.list[id] = self;
	return self;
}
Player.list = {};
Player.onConnect = function(socket,name){
	var player = Player(socket.id,name);
	socket.on('keyPress',function(data){
		if(data.inputId === 'left')
			player.pressingLeft = data.state;
		else if(data.inputId === 'right')
			player.pressingRight = data.state;
		else if(data.inputId === 'up')
			player.pressingUp = data.state;
		else if(data.inputId === 'down')
			player.pressingDown = data.state;
		else if(data.inputId === 'attack')
			player.pressingAttack = data.state;
		else if(data.inputId === 'mouseAngle')
			player.mouseAngle = data.state;
	});
	
}
Player.onDissconnect = function(socket){
	delete Player.list[socket.id];
}

Player.update = function(){
	var pack = [];
	for(var i in Player.list){
		var	player = Player.list[i];
		player.update();
		pack.push({
			x:player.x,
			y:player.y,
			number:player.number,
			name:player.name
		});
		
	}
	return pack;
}
//////////PLAYER ^^////
//-------////

//////////////// BULLET
var Bullet = function(parent, angle){
	var self = Entity();
	self.id = Math.random();
	self.spdX = Math.cos(angle/180*Math.PI)*10;
	self.spdY = Math.sin(angle/180*Math.PI)*10;
	self.parent = parent;
	
	self.timer = 0;
	self.toRemove = false;
	var super_update = self.update;
	self.update = function(){
		if(self.timer++ > 100)
			self.toRemove = true;
		super_update();
		
		for(var i in Player.list){
			var p = Player.list[i];
			//console.log(self.getDistance(p) + " ____" + self.parent + " === " + p.id);
			if(self.getDistance(p) < 20 && self.parent != p.id){
				//handle collision ex hp --
				self.toRemove = true;
			}
		}
	} 
	
	Bullet.list[self.id] = self;
	return self;
}
Bullet.list = {};

Bullet.update = function(){
	var pack = [];
	for(var i in Bullet.list){
		var	bullet = Bullet.list[i];
		bullet.update();
		if(bullet.toRemove)
			delete Bullet.list[i];
		else
			pack.push({
				x:bullet.x,
				y:bullet.y
			 });
		
	}
	return pack;
}
////////////// BULLET ^^
var DEBUG = true;
var PASS = "eliisawesome";
// var USERS = {
// 	"bob":"asd",
//
// }
var isValidPassword = function(data,cb){
	setTimeout(function(){
		cb(PASS === data.password);
	},10);
	
}
var isUsernameTaken = function(data,cb){
	setTimeout(function(){
		cb(USERS[data.username]);
	},10);
}
var addUser = function(data,cb){
	setTimeout(function(){
		USERS[data.username] = data.password;
		cb();
	},10);
}

var io = require('socket.io')(serv,{});
io.sockets.on('connection',function(socket){
	
	socket.id = Math.random();
	SOCKET_LIST[socket.id] = socket;
	
	socket.on('signIn',function(data){
		isValidPassword(data,function(res){
			if(res){
				//console.log("name = " + data.username);
				Player.onConnect(socket,data.username);
				socket.emit('signInResponse',{success:true});
			}else{
				socket.emit('signInResponse',{success:false});
			}
		});
	});
	// socket.on('signUp',function(data){
// 		isUsernameTaken(data,function(res){
// 			if(res){
// 				socket.emit('signUpResponse',{success:false});
// 			}else{
// 				addUser(data,function(){
// 					socket.emit('signUpResponse',{success:true});
// 				});
// 			}
// 		});
// 	});
	
	socket.on('disconnect',function(){
		delete SOCKET_LIST[socket.id];
		Player.onDissconnect(socket);
		
	});
	socket.on('sendMsgToServer',function(data){
		var playerName = Player.list[socket.id].name; //("" + socket.id).slice(2,7);
		for(var i in SOCKET_LIST){
			SOCKET_LIST[i].emit('addToChat',{name:playerName,value:data});//playerName + ': '+ data);
		}
		
	});
	socket.on('evalServer',function(data){
		if(!DEBUG)
			return;
		var res = eval(data);
		socket.emit('evalAnswer',res);
		
	});
	
	
	console.log('socket connection')
});

setInterval(function(){
	var pack = {
		player:Player.update(),
		bullet:Bullet.update(),
	}

	for( var i in SOCKET_LIST){
		var socket = SOCKET_LIST[i];
		socket.emit('newPositions',pack);
	}
	
},1000/25);