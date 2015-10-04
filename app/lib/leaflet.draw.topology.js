(function() {
  if (!L.Draw) {
      // Leaflet.Draw not available.
      return;
  }

  L.Draw.Topology = {};

  L.Draw.Topology.Handler = {};

  L.Draw.Topology._activated = false;

  L.Draw.Topology.init = function() {
    var cookie = L.Draw.Topology._getCookie('L.Draw.Topology.activated');
    L.Draw.Topology._activated = cookie && cookie == 'true';
  }

  L.Draw.Topology.activate = function() {
    L.Draw.Topology._activated = true;
    L.Draw.Topology._setCookie('L.Draw.Topology.activated', 'true', 365);
  }

  L.Draw.Topology.deactivate = function() {
    L.Draw.Topology._activated = false;
    L.Draw.Topology._setCookie('L.Draw.Topology.activated', 'false', 365);
  }

  L.Draw.Topology.isActivated = function() {
    return L.Draw.Topology._activated;
  }

  L.Draw.Topology._getCookie = function(cname) {
    var name = cname + "=";
    var ca = document.cookie.split(';');
    for(var i=0; i<ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1);
        if (c.indexOf(name) == 0) return c.substring(name.length, c.length);
    }
    return undefined;
  }

  L.Draw.Topology._setCookie = function(cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays*24*60*60*1000));
    var expires = "expires="+d.toUTCString();
    document.cookie = cname + "=" + cvalue + "; " + expires;
  }

  L.Draw.Topology.Handler.Polyline = L.Handler.PolylineSnap.extend({

    initialize: function(poly, options) {
      L.Handler.PolylineSnap.prototype.initialize.call(this, poly, options);
    },

    _createMarker: function(latlng, index) {
      var marker = L.Handler.PolylineSnap.prototype._createMarker.call(this, latlng, index);
      marker.on('dragstart', this._startEvent, this);
      marker.on('drag', this._dragEvent, this);
      marker.on('dragend', this._endEvent, this);
      L.Draw.Topology.Handler.Polyline._editedMarkers.push(marker);
      return marker;
    },

    _startEvent: function(e) {
      if (!L.Draw.Topology._activated) {
        return;
      }
      this.snappedMarkers_ = this._findIdenticalPoints(e.target.getLatLng());
    },

    _dragEvent: function(e) {
      if (!L.Draw.Topology._activated) {
        return;
      }
      if (!this.snappedMarkers_) {
        return;
      }
      var marker = e.target;
      var latlng = marker.getLatLng();
      this.snappedMarkers_.forEach(function(m) {
        if (L.stamp(marker) != L.stamp(m)) {
          m.setLatLng(latlng);
          var event = {target: m};
          m.fire('drag', event);
        }
      }, this);
    },

    _endEvent: function(e) {
      if (!L.Draw.Topology._activated) {
        return;
      }
      this.snappedMarkers_ = null;
    },

    _removeMarker: function(marker) {
      L.Draw.Topology.Handler.Polyline._editedMarkers.forEach(function(m, i, arr) {
        if (L.stamp(marker) == (L.stamp(m))) {
          arr.splice(i, 1);
          return;
        }
      });
      L.Handler.PolylineSnap.prototype._removeMarker.call(this, marker);
    },

    updateMarkers: function() {
      L.Draw.Topology.Handler.Polyline._editedMarkers = [];
      L.Handler.PolylineSnap.prototype.updateMarkers.call(this);
    },

    removeHooks: function() {
      L.Handler.PolylineSnap.prototype.removeHooks.call(this);
      L.Draw.Topology.Handler.Polyline._editedMarkers = [];
    },

    _findIdenticalPoints: function(latlng) {
      var result = [];
      L.Draw.Topology.Handler.Polyline._editedMarkers.forEach(function(marker) {
        if (this._equal(marker.getLatLng(), latlng)) {
          result.push(marker);
        }
      }, this);
      return result;
    },

    _equal: function(p1, p2) {
      var tolerance = 0.01,
          latDiff = Math.abs(p1.lat - p2.lat),
          lonDiff = Math.abs(p1.lng - p2.lng);

      return latDiff < tolerance && lonDiff < tolerance;
    }
  });

  L.Draw.Topology.Handler.Polyline._editedMarkers = [];

  L.Draw.Topology.actions = {};
  L.Draw.Topology.actions.topology = {};
  L.Draw.Topology.actions.topology.title = 'Enable/disable topology plugin.';
  L.Draw.Topology.actions.topology.text = 'Topology';

  L.EditToolbar.prototype.getActions = function (handler) {
    var actions = [
  		{
  			title: L.drawLocal.edit.toolbar.actions.save.title,
  			text: L.drawLocal.edit.toolbar.actions.save.text,
  			callback: this._save,
  			context: this
  		},
  		{
  			title: L.drawLocal.edit.toolbar.actions.cancel.title,
  			text: L.drawLocal.edit.toolbar.actions.cancel.text,
  			callback: this.disable,
  			context: this
  		}
    ];

    if (handler.type == 'edit') {
      actions.push({
  			title: L.Draw.Topology.actions.topology.title,
  			text: L.Draw.Topology.actions.topology.text,
  			callback: this.switchTopologyPlugin,
        init: this.initTopologyPlugin
  			//context: this
  		});
    }

    return actions;
  };

  L.EditToolbar.prototype.switchTopologyPlugin = function() {
		if (L.DomUtil.hasClass(this, 'active')) {
			L.DomUtil.removeClass(this, 'active');
			L.Draw.Topology.deactivate();
		} else {
			L.DomUtil.addClass(this, 'active');
			L.Draw.Topology.activate();
    }
  };

  L.EditToolbar.prototype.initTopologyPlugin = function() {
    if (L.Draw.Topology.isActivated()) {
      L.DomUtil.addClass(this, 'active');
    }
  }

  L.EditToolbar.prototype.addToolbar = function(map) {
    var container = L.Toolbar.prototype.addToolbar.call(this, map);

		this._checkDisabled();

		this.options.featureGroup.on('layeradd layerremove', this._checkDisabled, this);

    L.Draw.Topology.init();

		return container;
  }

  L.EditToolbar.prototype._createButton = function(options) {
    var link = L.DomUtil.create('a', options.className || '', options.container);
		link.href = '#';

		if (options.text) {
			link.innerHTML = options.text;
		}

		if (options.title) {
			link.title = options.title;
		}

    var context = options.context || link;

		L.DomEvent
			.on(link, 'click', L.DomEvent.stopPropagation)
			.on(link, 'mousedown', L.DomEvent.stopPropagation)
			.on(link, 'dblclick', L.DomEvent.stopPropagation)
			.on(link, 'click', L.DomEvent.preventDefault)
			.on(link, 'click', options.callback, context);

    if (options.init) {
      L.DomEvent.on(link, 'load', options.init, options.context);
    }

		return link;
  };

L.EditToolbar.prototype._createActions = function(handler) {
  var container = this._actionsContainer,
    buttons = this.getActions(handler),
    l = buttons.length,
    li, di, dl, button;

  // Dispose the actions toolbar (todo: dispose only not used buttons)
  for (di = 0, dl = this._actionButtons.length; di < dl; di++) {
    this._disposeButton(this._actionButtons[di].button, this._actionButtons[di].callback);
  }
  this._actionButtons = [];

  // Remove all old buttons
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  for (var i = 0; i < l; i++) {
    if ('enabled' in buttons[i] && !buttons[i].enabled) {
      continue;
    }

    li = L.DomUtil.create('li', '', container);

    button = this._createButton({
      title: buttons[i].title,
      text: buttons[i].text,
      container: li,
      callback: buttons[i].callback,
      context: buttons[i].context
    });

    if (buttons[i].init) {
      var context = buttons[i].context || button;
      buttons[i].init.call(context);
    }

    this._actionButtons.push({
      button: button,
      callback: buttons[i].callback
    });
  }
};

})();
