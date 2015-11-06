var validate = require('../lib/validate');

module.exports = function(context, d) {

  CodeMirror.keyMap.tabSpace = {
      Tab: function(cm) {
          var spaces = new Array(cm.getOption('indentUnit') + 1).join(' ');
          cm.replaceSelection(spaces, 'end', '+input');
      },
      fallthrough: ['default']
  };

    function saveAction() {
        saver(context);
        return false;
    }

    function render(selection) {
        var textarea = selection
            .html('')
            .append('textarea');

        var editor = CodeMirror.fromTextArea(textarea.node(), {
            mode: 'text/javascript',
            matchBrackets: true,
            tabSize: 2,
            gutters: ['error'],
            theme: 'eclipse',
            autofocus: (window === window.top),
            keyMap: 'tabSpace',
            lineNumbers: true
        });

        editor.setValue(d.content);

        editor.on('change', updateContent);

        function updateContent() {
          d.content = editor.getValue();
        }
    }

    render.off = function() {
        context.dispatch.on('change.json', null);
    };

    return render;
};
