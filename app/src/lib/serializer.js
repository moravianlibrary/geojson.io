module.exports = function(object) {

  function serializeObject(object, identCount) {
    var objectLen = Object.keys(object).length;
    var i = 1;
    var result = '';
    var identation = Array(identCount + 1).join(' ');
    result += '{\n';
    for (var key in object) {
      var value = object[key];
      result += identation + '  ' + key + ': ' + serialize(value, identCount + 2);

      if (i++ == objectLen) {
        result += '\n';
      } else {
        result += ',\n';
      }
    }
    result += identation + '}';
    return result;
  }

  function serializeArray(object, identCount) {
    var objectLen = object.length;
    var i = 1;
    var result = '';
    var identation = Array(identCount + 1).join(' ');
    result += '[\n';

    object.forEach(function(value) {
      result += identation + '  ' + serialize(value, identCount + 2);

      if (i++ == objectLen) {
        result += '\n';
      } else {
        result += ',\n';
      }
    });

    result += identation + ']';
    return result;
  }

  function serializeFunction(object, identCount) {
    var result = object.toString();
    var lines = result.split('\n');
    if (lines.count <= 1) {
      return result;
    }

    var firstSpaces = /^\s*/
    var originIdent = firstSpaces.exec(lines[1])[0].length;
    var diffIdent = (identCount + 2) - originIdent;

    if (diffIdent == 0) {
      return result;
    } else if (diffIdent > 0) {
      addIdent = Array(diffIdent + 1).join(' ');
      lines.forEach(function(x, i, arr) {
        if (i == 0) {
          // skip first lines
          return;
        }
        arr[i] = addIdent + x;
      });
      return lines.join('\n');
    } else {
      lines.forEach(function(x, i, arr) {
        if (i == 0) {
          // skip first lines
          return;
        }
        var countSpaces = firstSpaces.exec(x)[0].length;
        var countSpacesToRemove = Math.min(countSpaces, diffIdent);
        arr[i] = x.substring(countSpacesToRemove);
      });
      return lines.join('\n');
    }
  }

  function serialize(object, identCount) {
    if (typeof object == 'object') {
      if (object instanceof Array) {
        return serializeArray(object, identCount);
      } else {
        return serializeObject(object, identCount);
      }
    } else if (typeof object == 'function') {
      return serializeFunction(object, identCount);
    } else if (typeof object == "string") {
      return '"' + object.toString() + '"';
    } else {
      return object.toString();
    }
  }

  return serialize(object, 0);

}
