/* Wick - (c) 2016 Zach Rispoli, Luca Damasco, and Josh Rispoli */

if(!window.Tools) Tools = {};

Tools.Cursor = function (wickEditor) {

    var that = this;

    var lastDoubleClickTime = null;
    var lastDoubleClickPos = {x:0,y:0};

    this.getCursorImage = function () {
        return "default";
    }

    this.getToolbarIcon = function () {
        return "resources/cursor.png";
    }

    this.getTooltipName = function () {
        return "Cursor";
    }

    this.setup = function () {
        var canvas = wickEditor.fabric.canvas;
        
        // Select objects on right click (fabric.js doesn't do this by default >.>)
        canvas.on('mouse:down', function(e) {
            if(e.e.button !== 2) return;
            //if(!(wickEditor.fabric.currentTool instanceof Tools.Cursor)) return;

            if (e.target && e.target.wickObjectID) {
                // Set active object of fabric canvas
                var id = canvas.getObjects().indexOf(e.target);
                canvas.setActiveObject(canvas.item(id)).renderAll();
            }

            if(!e.target) {
                // Didn't right click an object, deselect everything
                canvas.deactivateAll().renderAll();
            }
        });

        // Double click functionality to edit symbols
        canvas.on('mouse:down', function(e) {
            if(e.e.button !== 0) return;
            if(!(wickEditor.currentTool instanceof Tools.Cursor)) return;

            var newDoubleClickPos = {x: e.e.clientX, y: e.e.clientX};
            var currentTime = new Date().getTime();

            var isSecondClick = lastDoubleClickTime !== null && currentTime-lastDoubleClickTime < 350;
            var mouseInSameArea = Math.abs(lastDoubleClickPos.x - newDoubleClickPos.x) < 3 && Math.abs(lastDoubleClickPos.y - newDoubleClickPos.y) < 3;

            if(isSecondClick && mouseInSameArea) {
                var selectedObject = wickEditor.fabric.getSelectedObject(WickObject);
                if(selectedObject && selectedObject.isSymbol) {
                    wickEditor.guiActionHandler.doAction("editObject");
                } else if (!selectedObject && !wickEditor.project.currentObject.isRoot) {
                    wickEditor.guiActionHandler.doAction("finishEditingObject");
                }
                lastDoubleClickTime = null;
            } else {
                lastDoubleClickTime = currentTime;
            }

            lastDoubleClickPos = newDoubleClickPos;
        });
    }

}