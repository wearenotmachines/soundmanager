var AudioGraph = function(debug) {
	
	this.debug = debug != undefined && debug != false;
	this.context = new AudioContext();
	this.nodes = {};
	this.filePath = undefined;
	this.ready = false;
	this.manager = undefined;
	this.currentNode = undefined;
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
							self.currentNode = self.nodes["source"];
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
	if (undefined==node) {
		node = this.currentNode;
	} else {
		node = this.resolveNode(node);
	}
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
	this.currentNode = delay;
	return this;

}


AudioGraph.prototype.pan = function(node, params) {
	if (undefined==params) {
		params = {};
	}
	
	params.label = undefined==params.label ? "pan" : params.label;
	params.panningModel = undefined==params.panningModel ? "equalpower" : params.panningModel; //of equalpower / HRTF
	params.distanceModel = undefined==params.distanceModel ? "linear" : params.distanceModel; //of linear/inverse/exponential
	params.refDistance = undefined==params.refDistance ? 1 : params.refDistance;
	params.maxDistance = undefined==params.maxDistance ? 10000 : params.maxDistance;
	params.rolloffFactor = undefined==params.rolloffFactor ? 1 : params.rolloffFactor;
	params.coneInnerAngle = undefined==params.coneInnerAngle ? 360 : params.coneInnerAngle;
	params.coneOuterAngle = undefined==params.coneOuterAngle ? 0 : params.coneOuterAngle;
	params.coneOuterGain = undefined==params.coneOuterGain ? 0 : params.coneOuterGain;

	node = this.resolveNode(node);

	var pan = this.nodes[params.label] = this.context.createPanner();

	for (var prop in params) {
		switch (prop) {
			case "label":
			case "orientation":
			case "position":
			case "velocity":
				continue;
			break;
			default:
			pan.prop = params[prop];
		}
	}

	if (undefined!=params.orientation) {
		pan.setOrientation(params.orientation.x, params.orientation.y, params.orientation.z);
	}

	if (undefined!=params.position) {
		pan.setPosition(params.position.x, params.position.y, params.position.z);
	}

	if (undefined!=params.velocity) {
		pan.setVelocity(params.velocity.x, params.velocity.y, params.velocity.z);
	}

	node.connect(pan);
	this.currentNode = pan;
	return this;

}

AudioGraph.prototype.filter = function(node, filterType, params) {
	if (undefined==params) {
		params = {};
	}
	
	params.label = undefined==params.label ? filterType : params.label;

	node = this.resolveNode(node);

	var filter = this.context.createBiquadFilter();
	filter.type = undefined == filterType ? "lowpass" : filterType;
	filter = this.setFilterParams(filter, params);
	this.nodes[params.label] = filter;

	node.connect(filter);
	this.currentNode = filter;
	return this;
}

AudioGraph.prototype.setFilterParams = function(filter, params) {
	params.frequency = undefined==params.frequency ? 350 : params.frequency; // 10 to the motherfuckin Nyquist freakwency homeboy
	params.detune = undefined==params.detune ? 0 : params.detune; //integer - represents 100th of a semitone
	params.gain = undefined==params.gain ? 0 : params.gain;  //in -40 - 40
	params.Q = undefined==params.Q ? 1 : params.Q; //in 0.0001 - 1000

	for (var prop in params) {
		switch (prop) {

			case "label":
			break

			default:
				filter[prop].value = params[prop];
		}
	}
	console.log(filter);
	return filter;
}

AudioGraph.prototype.gain = function(node, params) {
	if (undefined==params) {
		params = {};
	}
	
	params.label = undefined==params.label ? "gain" : params.label;

	node = this.resolveNode(node);

	var gain = this.nodes[params.label] = this.context.createGain();

	gain.gain.value = params.gain==undefined ? 0 : params.gain;

	node.connect(gain);
	this.currentNode = gain;
	return this;

}

AudioGraph.prototype.sendParamChange = function(toNode, params, transitionType) {
	node = this.resolveNode(toNode);
	for (var prop in params) {
		if (transitionType=="snap" || transitionType=="instant") {
			if (params[prop].timing!=undefined) {
				node[prop].setValueAtTime(params[prop].value, node.context.currentTime+params[prop].timing);
			} else {
				node[prop].value = params[prop].value;
			}
		} else if (transitionType=="linear") {
			if (params[prop].timing!=undefined) {
				node[prop].linearRampToValueAtTime(params[prop].value, node.context.currentTime+params[prop].timing);
			} else {
				node[prop].linearRampToValueAtTime(params[prop].value, node.context.currentTime);
			}
		} else {
			if (params[prop].timing!=undefined) {
				node[prop].exponentialRampToValueAtTime(params[prop].value, node.context.currentTime+params[prop].timing);
			} else {
				node[prop].exponentialRampToValueAtTime(params[prop].value, node.context.currentTime);
			}
		}
	}
	return this;

}