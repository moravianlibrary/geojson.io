var geojson = require('../panel/geojson'),
    javascript = require('../panel/javascript');

module.exports = function(context, pane) {

  var mode = null;
  var selection = null;

  var tabs = [];
  var idCounter = 0;

  // var buttonData = [{
  //     icon: 'code',
  //     title: ' JSON',
  //     alt: 'JSON Source',
  //     behavior: json
  // }, {
  //     icon: 'table',
  //     title: ' Table',
  //     alt: 'Edit feature properties in a table',
  //     behavior: table
  // }, {
  //     icon: 'question',
  //     title: ' Help',
  //     alt: 'Help',
  //     behavior: help
  // }];

  function update(s) {
    selection = s || selection;
    var buttons = selection
        .selectAll('button')
        .data(tabs, function(d) { return d.title; });

    var enter = buttons.enter()
        .append('button')
        .attr('title', function(d) { return d.alt; })
    enter.append('span')
        .attr('class', function(d) { return 'icon-' + d.icon; });
    enter
        .append('span')
        .text(function(d) { return d.title; });

    buttons.exit().remove();

    buttons.on('click', buttonClick);

    d3.select(buttons.node()).trigger('click');

    function buttonClick(d) {
        buttons.classed('active', function(_) { return d.title == _.title; });
        if (mode) mode.off();
        mode = d.behavior(context, d);
        pane.call(mode);
    }
  }

  function getBehavior(type) {
    var behaviors = {
      geojson: geojson,
      javascript: javascript
    };
    return behaviors[type];
  }

  function openTabInternal(title, type, content) {
    var tab = {
      title: title,
      content: content,
      icon: 'code',
      behavior: getBehavior(type)
    }
    tabs.push(tab);
  }

  function openTab(title, type, content, doUpdate) {
    content = content || '';
    doUpdate = doUpdate === undefined ? true : doUpdate;
    var tab = getTab(title);

    if (tab) {
      tab.content = content;
    } else {
      openTabInternal(title, type, content);
    }

    if (doUpdate) {
      update();
    }
  }

  function getTab(title) {
    var result = null;
    tabs.forEach(function(tab) {
      if (tab.title == title) {
        result = tab;
        return;
      }
    });
    return result;
  }

  return {
    update: update,
    openTab: openTab,
    getTab: getTab
  }

};
