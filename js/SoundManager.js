var SoundManager = function(debug) {

	this.debug = debug != undefined && debug != false;
	this.graphs = {};
}

SoundManager.prototype.addGraph = function(graph, withLabel) {
	this.graphs[withLabel] = graph;
}

SoundManager.prototype.preload = function(promises) {

	return Promise.all(promises);

}