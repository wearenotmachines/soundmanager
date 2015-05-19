var AudioGraph = function(debug) {
	
	this.debug = debug != undefined && debug != false;
	this.context = new AudioContext();
	this.nodes = {};
	this.filePath = undefined;
	this.ready = false;
	this.manager = undefined;
	if (this.debug) console.log("AudioGraph created");
	return this;
}

AudioGraph.prototype.loadSoundFromFile = function(pathToFile) {
	var self = this;
	this.filePath = pathToFile;
	var p = new Promise(function(resolve, reject) {
		var xhr = new XMLHttpRequest();
		xhr.open('GET', pathToFile, true);
		xhr.responseType = 'arraybuffer';
		xhr.send(null);
		xhr.onload = function() {
			if (this.status==200) {
				if (self.debug) console.log(pathToFile+" is loaded");
				resolve({"data" : this.response, "path" : pathToFile});
			} else {
				if (self.debug) console.log("Error loading "+pathToFile+": "+this.responseText);
				reject(Error(this.responseText));
			}
		}
	});

	return p;

}

AudioGraph.prototype.addSource = function(sound) {
	var self = this;
	var p = new Promise(function(resolve, reject) {

		if (sound instanceof Promise) {
			sound.then(
				function(promiseData) {
					var source = self.nodes["source"] = self.context.createBufferSource();
					self.status = "decoding";
					if (self.debug) console.log("New source created: "+promiseData.path);
					self.context.decodeAudioData(
						promiseData.data,
						function(buffer) {
							source.buffer = buffer;
							if (self.debug) console.log("Data for "+promiseData.path+" buffered");
							self.status = "buffered";
							resolve(self);
						}

					);
				},
				function(error) {
					reject(error);
				}		
			);
		} else {
			if (self.debug) console.log("Raw data passed to addSource");
		}

	});

	return p;

}

AudioGraph.prototype.resolveNode = function(node) {
	if (undefined==node) {
		return this.nodes["source"];
	} else if (typeof node === "string") {
		node = this.nodes[node];
	}
	return node;
}

AudioGraph.prototype.connectToOutput = function(node) {
	node = this.resolveNode(node);
	console.log(node);
	node.connect(node.context.destination);
	return this;
}

AudioGraph.prototype.play = function(node, params) {
	node = this.resolveNode(node);

	if (params && params.start) {
		node.start(params.start);
	} else {
		node.start();
	}
	return this;
}

AudioGraph.prototype.stop = function(node, params) {
	node = this.resolveNode(node);
	node.stop();
	return this;
}

AudioGraph.prototype.delay = function(node, params) {
	if (undefined==params) {
		params = {};
	}
	
	params.label = undefined==params.label ? "delay" : params.label;
	params.delayTime = undefined==params.delayTime ? 0.5 : params.delayTime;
	params.maxDelay = undefined==params.maxDelay ? 10 : params.maxDelay;
	node = this.resolveNode(node);

	var delay = this.nodes[params.label] = this.context.createDelay(params.maxDelay);
	delay.delayTime.value = params.delayTime;
	node.connect(delay);
	return this;

}