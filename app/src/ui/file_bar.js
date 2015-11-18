var shpwrite = require('shp-write'),
    clone = require('clone'),
    geojson2dsv = require('geojson2dsv'),
    topojson = require('topojson'),
    saveAs = require('filesaver.js'),
    tokml = require('tokml'),
    githubBrowser = require('github-file-browser'),
    gistBrowser = require('gist-map-browser'),
    geojsonNormalize = require('geojson-normalize'),
    wellknown = require('wellknown'),
    vex = require('vex-js'),
    vexDialog = require('vex-js/js/vex.dialog.js'),
    S = require('string'),
    $ = require('jquery');

require('jstree');

var share = require('./share'),
    modal = require('./modal.js'),
    flash = require('./flash'),
    zoomextent = require('../lib/zoomextent'),
    readFile = require('../lib/readfile'),
    meta = require('../lib/meta.js'),
    serializer = require('../lib/serializer'),
    loading = require('../ui/loading.js'),
    config = require('../config.js')(location.hostname),
    github = require('../source/github');

/**
 * This module provides the file picking & status bar above the map interface.
 * It dispatches to source implementations that interface with specific
 * sources, like GitHub.
 */
module.exports = function fileBar(context) {

    var shpSupport = typeof ArrayBuffer !== 'undefined';
    vex.defaultOptions.className = 'vex-theme-os';
    vexDialog.defaultOptions.showCloseButton = true;
    github = github(context);

    var exportFormats = [{
        title: 'GeoJSON',
        action: downloadGeoJSON
    }, {
        title: 'TopoJSON',
        action: downloadTopo
    }, {
        title: 'CSV',
        action: downloadDSV
    }, {
        title: 'KML',
        action: downloadKML
    }, {
        title: 'WKT',
        action: downloadWKT
    }];

    if (shpSupport) {
        exportFormats.push({
            title: 'Shapefile',
            action: downloadShp
        });
    }

    function bar(selection) {

        var actions = [{
          title: 'Nová séria',
          action: newSerie
        }, {
          title: 'Otvoriť sériu',
          action: openSerie
        }, {
          title: 'Uložiť',
          action: saveWork
        }, {
          title: 'Publikovať',
          action: publishWork
        }, {
          title: 'Import',
          alt: 'GeoJSON, TopoJSON, KML, CSV, GPX and OSM XML supported',
          action: blindImport
        }, {
          title: 'Export',
          children: exportFormats
        }, {
            title: 'Nástroje',
            children: [
                {
                    title: 'Add map layer',
                    alt: 'Add a custom tile layer',
                    action: function() {
                        var layerURL = prompt('Layer URL \n(http://tile.stamen.com/watercolor/{z}/{x}/{y}.jpg)');
                        if (layerURL === null) return;
                        var layerName = prompt('Layer name');
                        if (layerName === null) return;
                        meta.adduserlayer(context, layerURL, layerName);
                    }
                },
                {
                    title: 'Zoom to features',
                    alt: 'Zoom to the extent of all features',
                    action: function() {
                        meta.zoomextent(context);
                    }
                },
                {
                    title: 'Clear',
                    alt: 'Delete all features from the map',
                    action: function() {
                        if (confirm('Are you sure you want to delete all features from this map?')) {
                            meta.clear(context);
                        }
                    }
                }
            ]
        }];

        var items = selection.append('div')
            .attr('class', 'inline')
            .selectAll('div.item')
            .data(actions)
            .enter()
            .append('div')
            .attr('class', 'item');

        var buttons = items.append('a')
            .attr('class', 'parent')
            .on('click', function(d) {
                if (d.action) d.action.apply(this, d);
            })
            .text(function(d) {
                return ' ' + d.title;
            });

        items.each(function(d) {
            if (!d.children) return;
            d3.select(this)
                .append('div')
                .attr('class', 'children')
                .call(submenu(d.children));
        });

        function sourceIcon(type) {
            if (type == 'github') return 'icon-github';
            else if (type == 'gist') return 'icon-github-alt';
            else return 'icon-file-alt';
        }

        function saveNoun(_) {
            buttons.filter(function(b) {
                return b.title === 'Save';
            }).select('span.title').text(_);
        }

        function submenu(children) {
            return function(selection) {
                selection
                    .selectAll('a')
                    .data(children)
                    .enter()
                    .append('a')
                    .attr('title', function(d) {
                        if (d.title == 'File' || d.title == 'GitHub' || d.title == 'Gist' || d.title == 'Add map layer' || d.title == 'Zoom to features' || d.title == 'Clear' || d.title == 'Random: Points' || d.title == 'Add bboxes' || d.title == 'Flatten Multi Features') return d.alt;
                    })
                    .text(function(d) {
                        return d.title;
                    })
                    .on('click', function(d) {
                        d.action.apply(this, d);
                    });
            };
        }

        function loadConfig(callback) {
          github.readFile('client/src/config.js', function(err, data) {
            loading.hide();
            if (err) {
              flash(context.container, 'Nastala neočakávaná chyba.');
              return;
            }

            context.serie.configString = data;
            context.serie.config = eval(data);
            callback.call(this);
          });
        }

        function newSerie() {
          loading.show();

          context.serie = {};

          loadConfig(function() {
            var areas = new Set();
            context.serie.config.series.forEach(function(serie) {
              var area = serie.title.split(':', 1)[0].trim();
              areas.add(area);
            });
            newSerieDialog(areas);
          });
        }

        function newSerieDialog(areas) {
          var input = '<label for="input-name">Názov novej série</label>'
                    + '<input id="input-name" name="name" type="text" required />'
                    + '<div class="radio-box"><div class="title">Názov oblasti, do ktorej séria spadá</div>'
                    + '<div class="vertical-scroll">'

          var first = true;
          areas.forEach(function(area) {
            if (first) {
              first = false;
              input += '<input type="radio" name="area" checked="true" value="' + area + '"/><span>' + area + '</span></br>';
            } else {
              input += '<input type="radio" name="area" value="' + area + '"/><span>' + area + '</span></br>';
            }
          });
          input += '</div><span class="other"><input id="radio-area-other" type="radio" name="area" value="&lt;other&gt;"/><input id="input-area-other" type="text" name="area-other" placeholder="Iná" /></span></div>';
          vexDialog.open({
            message: 'Vytvorenie novej série',
            input: input,
            afterOpen: function() {
              var inputAreaOther = document.getElementById('input-area-other');
              inputAreaOther.addEventListener('focus', function() {
                document.getElementById('radio-area-other').checked = true;
              });
            },
            callback: function(data) {
              if (!data) {
                return;
              }
              var area = data.area;
              if (area == '<other>') {
                area = data['area-other'];
              }
              var sname = S(data.name).slugify().s;
              context.serie.name = data.name;
              context.serie.filename = S(data.area + ' ' + data.name).slugify().s;
              context.serie.area = area;

              var serie = {
                title: area + ': ' + data.name,
                layer: context.serie.filename,
                template: context.serie.filename + '.txt',
                formatFunctions: context.serie.config.formatFunctionsTemplate
              };
              context.serie.config.series.push(serie);
              context.serie.configString = 'var mapseries = {};\nmapseries.config = ' + serializer(context.serie.config);

              github.lsPath('data', function(err, paths) {
                if (!err) {
                  if (!paths) {
                    return;
                  }
                  var found = false;
                  paths.forEach(function(path) {
                    if (path.name == context.serie.filename + '.json') {
                      found = true;
                      return;
                    }
                  });
                  if (found) {
                    flash(context.container, 'Séria s názvom ' + context.serie.filename + '.json' + ' už existuje.');
                    return;
                  }
                }
                meta.clear(context);
                context.editor.openTab('geojson', 'geojson', null, false);
                github.readFile('client/src/templates/template.txt', function(err, data) {
                  if (err) {
                    console.error(err);
                    flash(context.container, 'Nastala neočakávaná chyba.');
                    return;
                  }
                  context.editor.openTab('template', 'javascript', data, false);
                  github.readFile('client/src/config.js', function(err, data) {
                    if (err) {
                      console.error(err);
                      flash(context.container, 'Nastala neočakávaná chyba.');
                      return;
                    }
                    context.editor.openTab('config', 'javascript', context.serie.configString, true);
                  });
                });

              });
            }
          });
        }

        function openSerie() {
          context.serie = {};

          loadConfig(function() {
            var series = {};
            context.serie.config.series.forEach(function(serie) {
              var tmp = serie.title.split(':');
              var area = tmp.splice(0, 1);
              var name = tmp.join(':');
              series[area] = series[area] || [];
              series[area].push({
                name: name,
                layer: serie.layer
              });
            });
            openSerieDialog(series);
          });
        }

        function openSerieDialog(series) {
          seriesTree = [];
          for (var area in series) {
            var names = series[area];
            names.forEach(function(name, i, arr) {
              arr[i] = {
                text: name.name,
                icon: 'jstree-file',
                layer: name.layer
              };
            });
            seriesTree.push({
              text: area,
              children: names
            });
          }

          vexDialog.open({
            message: 'Otvoriť existujúcu sériu',
            input: '<div id="file-tree"></div>',
            contentCSS: {
              width: '600px'
            },
            buttons: [],
            afterOpen: function() {
              var _this = this;
              $('#file-tree').jstree({
                core: {
                  data: seriesTree
                }
              }).on('changed.jstree', function(e, data) {
                if (data.node.parent != '#') {
                  var parent = data.instance.get_node(data.node.parent);
                  vex.close(_this.id);
                  context.serie.area = parent.text;
                  context.serie.name = data.node.text;
                  doOpen(data.node.original.layer);
                }
              });
            }
          });
        }

        function doOpen(serie) {
          loading.show();

          context.serie.filename = serie;

          var errmsg = 'Nastala neočakávaná chyba.';
          var geojsonPath = 'data/' + serie + '.json';
          var templatePath = 'client/src/templates/' + serie + '.txt';

          github.readFile(geojsonPath, function(err, data) {
            if (err) {
              loading.hide();
              console.error(err);
              flash(context.container, errmsg);
              return;
            }
            context.editor.openTab('geojson', 'geojson', data, false);
            github.readFile(templatePath, function(err, data) {
              loading.hide();
              if (err) {
                console.error(err);
                flash(context.container, errmsg);
                return;
              }
              context.editor.openTab('template', 'javascript', data, false);
              context.editor.openTab('config', 'javascript', context.serie.configString, true);
            });
          });
        }

        function doSaveWork(callback) {
          var geojson = context.editor.getTab('geojson').content;
          var template = context.editor.getTab('template').content;
          var config = context.editor.getTab('config').content;

          var geojsonPath = 'data/' + context.serie.filename + '.json';
          var templatePath = 'client/src/templates/' + context.serie.filename + '.txt';
          var configPath = 'client/src/config.js';

          github.writeFile(geojsonPath, geojson, 'Updated ' + geojsonPath, function(err) {
            if (err) {
              callback.call(this, err);
              return;
            }
            github.writeFile(templatePath, template, 'Updated ' + templatePath, function(err) {
              if (err) {
                callback.call(this, err);
                return;
              }
              github.writeFile(configPath, config, 'Updated ' + configPath, function(err) {
                if (err) {
                  callback.call(this, err);
                  return;
                }
                callback.call(this);
              });
            });
          });
        }

        function saveWork() {
          loading.show();
          doSaveWork(function(err) {
            loading.hide();
            if (err) {
              flash(context.container, 'Uloženie zlyhalo. Nastala neočakávaná chyba.');
            } else {
              flash(context.container, 'Úspešne uložené.');
            }
          });
        }

        function publishWork() {
          loading.show();
          doSaveWork(function(err) {
            if (err) {
              loading.hide();
              flash(context.container, 'Ukladanie zlyhalo. Nastala neočakávaná chyba.');
              return;
            }
            github.pullRequest(function(err) {
              loading.hide();
              if (err) {
                flash(context.container, 'Publikovanie zlyhalo. Nastala neočakávaná chyba.');
              } else {
                flash(context.container, 'Úspešne publikované.');
                context.dispatch.clear();
              }
            });
          });
        }

        function blindImport() {
            var put = d3.select('body')
                .append('input')
                .attr('type', 'file')
                .style('visibility', 'hidden')
                .style('position', 'absolute')
                .style('height', '0')
                .on('change', function() {
                    var files = this.files;
                    if (!(files && files[0])) return;
                    readFile.readAsText(files[0], function(err, text) {
                        readFile.readFile(files[0], text, onImport);
                        if (files[0].path) {
                            context.data.set({
                                path: files[0].path
                            });
                        }
                    });
                    put.remove();
                });
            put.node().click();
        }

        function onImport(err, gj, warning) {
            gj = geojsonNormalize(gj);
            if (gj) {
                context.data.mergeFeatures(gj.features);
                if (warning) {
                    flash(context.container, warning.message);
                } else {
                    flash(context.container, 'Imported ' + gj.features.length + ' features.')
                        .classed('success', 'true');
                }
                zoomextent(context);
            }
        }
    }

    function downloadTopo() {
        var content = JSON.stringify(topojson.topology({
            collection: clone(context.data.get('map'))
        }, {'property-transform': allProperties}));

        saveAs(new Blob([content], {
            type: 'text/plain;charset=utf-8'
        }), 'map.topojson');

    }

    function downloadGeoJSON() {
        if (d3.event) d3.event.preventDefault();
        var content = JSON.stringify(context.data.get('map'));
        var meta = context.data.get('meta');
        saveAs(new Blob([content], {
            type: 'text/plain;charset=utf-8'
        }), (meta && meta.name) || 'map.geojson');
    }

    function downloadDSV() {
        if (d3.event) d3.event.preventDefault();
        var content = geojson2dsv(context.data.get('map'));
        saveAs(new Blob([content], {
            type: 'text/plain;charset=utf-8'
        }), 'points.csv');
    }

    function downloadKML() {
        if (d3.event) d3.event.preventDefault();
        var content = tokml(context.data.get('map'));
        var meta = context.data.get('meta');
        saveAs(new Blob([content], {
            type: 'text/plain;charset=utf-8'
        }), 'map.kml');
    }

    function downloadShp() {
        if (d3.event) d3.event.preventDefault();
        d3.select('.map').classed('loading', true);
        try {
            shpwrite.download(context.data.get('map'));
        } finally {
            d3.select('.map').classed('loading', false);
        }
    }

    function downloadWKT() {
        if (d3.event) d3.event.preventDefault();
        var contentArray = [];
        var features = context.data.get('map').features;
        if (features.length === 0) return;
        var content = features.map(wellknown.stringify).join('\n');
        var meta = context.data.get('meta');
        saveAs(new Blob([content], {
            type: 'text/plain;charset=utf-8'
        }), 'map.wkt');
    }

    function allProperties(properties, key, value) {
        properties[key] = value;
        return true;
    }

    return bar;
};
