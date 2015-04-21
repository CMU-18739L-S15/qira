// Scripts to load after UI has been initialized.
var scripts = ["/client/controls.js", "/client/ida.js", "/client/idump.js", "/client/regmem.js",
               "/client/vtimeline.js", "/client/strace.js", "/client/haddrline.js",
               "/client/static/static.js", "/client/static/graph.js"];

$(document).ready(function() {
    var myDocker = new wcDocker(document.body, {"theme": "qira_theme", "themePath": ""});

    var cfgDef = $.Deferred();
    var memoryDef = $.Deferred();
    var flatDef = $.Deferred();
    var dynamicDef = $.Deferred();
    var timelineDef = $.Deferred();

    myDocker.registerPanelType('Timeline', {
        onCreate: function(myPanel, options) {
            var layout = myPanel.layout();
            layout.addItem($("<div id='vtimelinebox'></div>"));
            timelineDef.resolve();
        },
    });

    myDocker.registerPanelType('Dynamic', {
        onCreate: function(myPanel, options) {
            myPanel.layout().addItem($($("#dynamic-template").remove().text()));
            dynamicDef.resolve();
        },
    });

    myDocker.registerPanelType('Memory', {
        onCreate: function(myPanel, options) {
            myPanel.layout().addItem($($("#hexeditor-template").remove().text()));
            memoryDef.resolve();
        },
    });

    myDocker.registerPanelType('Flat', {
        onCreate: function(myPanel, options) {
            myPanel.layout().addItem($("<div class='fill' id='flat-static'></div>"));
            flatDef.resolve();
        },
    });

    myDocker.registerPanelType('Control Flow', {
        onCreate: function(myPanel, options) {
            myPanel.layout().addItem($("<div class='fill' id='cfg-static'></div>"));
            cfgDef.resolve();
        },
    });

    var timelinePanel = myDocker.addPanel("Timeline", wcDocker.DOCK.LEFT, null);

    //Limit the width of the vtimeline. Scrollbar exists if it overflows.
    timelinePanel.maxSize(100, 0);

    var dynamicPanel = myDocker.addPanel("Dynamic", wcDocker.DOCK.RIGHT, timelinePanel);
    var cfgPanel = myDocker.addPanel("Control Flow", wcDocker.DOCK.RIGHT, dynamicPanel);
    var flatPanel = myDocker.addPanel("Flat", wcDocker.DOCK.BOTTOM, cfgPanel, {h: 300});
    var memoryPanel = myDocker.addPanel("Memory", wcDocker.DOCK.BOTTOM, dynamicPanel, {h: 400});

    $.when(timelineDef, dynamicDef, cfgDef, flatDef, memoryDef)
        .done(function() {
            //UI elements now exist in the DOM.
            head.load(scripts);
        });

});
