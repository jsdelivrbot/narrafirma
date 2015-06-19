import m = require("mithril");
import translate = require("./translate");
import surveyBuilderMithril = require("../surveyBuilderMithril");
import PanelBuilder = require("panelBuilder/PanelBuilder");

"use strict";

function computeColumnsForItemPanelSpecification(itemPanelSpecification, configuration) {
    // var self = this;
    
    var columns = [];
    
    var maxColumnCount = 5;
    var columnCount = 0;
    
    var displayTypesToDisplay = {
       text: true,
       textarea: true,
       select: true,
       radiobuttons: true
    };
    
    var fieldsToInclude = [];
    var panelFields = itemPanelSpecification.panelFields;
    
    // Put the columns in the order supplied if using includeAllFields, otherwise put them in order of panel specification
    if (configuration.includeAllFields && configuration.includeAllFields.constructor === Array) {
        configuration.includeAllFields.forEach(function (fieldName) {
            panelFields.forEach(function (fieldSpecification) {
                if (fieldSpecification.id === fieldName) fieldsToInclude.push(fieldSpecification);
            });
        });
    } else {
        panelFields.forEach(function (fieldSpecification) {
            var includeField = false;
            if (configuration.includeAllFields) {
                // TODO: improve this check if need to exclude other fields?
                if (fieldSpecification.displayType !== "label" && fieldSpecification.displayType !== "header") {
                    fieldsToInclude.push(fieldSpecification);
                }
            } else {
                if (columnCount < maxColumnCount) {
                    if (displayTypesToDisplay[fieldSpecification.displayType]) fieldsToInclude.push(fieldSpecification);
                    columnCount++;
                }
            }
        });
    }
    
    fieldsToInclude.forEach(function (fieldSpecification) {
        // console.log("includeField", fieldSpecification);
        var newColumn =  {
            field: fieldSpecification.id,
            label: translate(fieldSpecification.id + "::shortName", fieldSpecification.displayName),
            // formatter: self.formatObjectsIfNeeded.bind(this),
            sortable: !configuration.moveUpDownButtons,
        };
        columns.push(newColumn);
        // console.log("newColumn", newColumn);
    });
    
    return columns;
}

// Sorts function derived from: http://lhorie.github.io/mithril-blog/vanilla-table-sorting.html
function sorts(panelBuilder, list) {
    return {
        onclick: function(e) {
            var prop = e.target.getAttribute("data-sort-by")
            if (prop) {
                console.log("Sorting by", prop);
                var first = list[0];
                list.sort(function(a, b) {
                    return a[prop] > b[prop] ? 1 : a[prop] < b[prop] ? -1 : 0;
                })
                if (first === list[0]) {
                    console.log("reversing");
                    list.reverse();
                }
                console.log("sorted list", list);
                panelBuilder.redraw();
            }
        }
    }
}

// Grid needs to be a component so it can maintain a local sorted list
var Grid = {
    controller: function(args) {
        var panelBuilder = args.panelBuilder;
        var model = args.model;
        var fieldSpecification = args.fieldSpecification;
        
        var configuration = {
            itemPanelID: undefined,
            itemPanelSpecification: undefined,
            idProperty: undefined,
            gridConfiguration: undefined   
        };
        
        var itemPanelID = fieldSpecification.displayConfiguration;
        if (!_.isString(itemPanelID)) {
            configuration = fieldSpecification.displayConfiguration;
            itemPanelID = configuration.itemPanelID;
        }
        
        var itemPanelSpecification = configuration.itemPanelSpecification;
        if (!itemPanelSpecification) {
            itemPanelSpecification = panelBuilder.getPanelDefinitionForPanelID(itemPanelID);
        }
        
        if (!itemPanelSpecification) {
            console.log("Trouble: no itemPanelSpecification for options: ", fieldSpecification);
        }
        
        if (!model) {
            console.log("Error: no model is defined for grid", fieldSpecification);
            throw new Error("Error: no model is defined for grid");
        }
        if (!model.get) {
            console.log("Error: model that supports get is needed for grid", fieldSpecification);
            throw new Error("Error: model that supports get is needed for grid");
        }
        
        // TODO: May want to use at or similar to get the value in case this is a plain object?
        var data = model.get(fieldSpecification.id);
        if (!data) {
            data = [];
            model.set(fieldSpecification.id, data);
        }
        
        var idProperty = configuration.idProperty;
        if (!idProperty) idProperty = "_id";
        this.idProperty = idProperty;
        
        var bigData = [];
        for (var i = 0; i < 5; i++) {
            for (var j = 0; j < data.length; j++) {
                var newItem = JSON.parse(JSON.stringify(data[j]));
                newItem[idProperty] = "item_" + (i * data.length + j);
                bigData.push(newItem);
                console.log("newItem", newItem);
            }
        }
        data = bigData;
        
        var columns = computeColumnsForItemPanelSpecification(itemPanelSpecification, configuration);
     
        this.data = data;
        this.columns = columns;
        this.itemBeingEdited = null;
        this.itemPanelSpecification = itemPanelSpecification;
    },
    
    view: function(ctrl, args) {
        var panelBuilder = args.panelBuilder;
        
        // return m("table", sorts(ctrl.list), [
        var table = m("table", sorts(panelBuilder, ctrl.data), [
            m("tr[style=outline: thin solid; background-color: #66CCFF]", ctrl.columns.map(function (column) {
                    return m("th[data-sort-by=" + column.field  + "]", {"text-overflow": "ellipsis"}, column.label)
                }).concat(m("th", ""))
            ),
            ctrl.data.map(function(item, index) {
                return Grid.rowForItem(ctrl, panelBuilder, item, index);
            }).concat(m("tr", [m("button", {onclick: Grid.addItem.bind(ctrl, panelBuilder)}, "Add")]))
        ]);
        
        // TODO: set class etc.
        return m("div", [table]);
    },
    
    addItem: function(panelBuilder) {
        var newItem = {};
        newItem[this.idProperty] = new Date().toISOString();
        this.data.push(newItem);
        this.itemBeingEdited = newItem;
        panelBuilder.redraw();       
    },
    
    deleteItem: function (panelBuilder, item, index) {
        // TODO: This needs to create an action that affects original list
        console.log("deleteItem", panelBuilder, item, index);
        this.data.splice(index, 1);
        panelBuilder.redraw();
    },
    
    editItem: function (panelBuilder, item, index) {
        // TODO: This needs to create an action that affects original list
        console.log("editItem", panelBuilder, item, index);
        
        this.itemBeingEdited = item;
        
        panelBuilder.redraw();
    },
    
    rowForItem: function (ctrl, panelBuilder, item, index) {
        if (ctrl.itemBeingEdited === item) {
            return m("tr", [
                m("td", {colSpan: ctrl.columns.length}, [m.component(<any>ItemPanel, {panelBuilder: panelBuilder, item: item, grid: ctrl})]),
                m("td", "Closer goes here")
            ]);
        }
        return m("tr", {key: item[ctrl.idProperty]}, ctrl.columns.map(function (column) {
            return m("td[style=outline: thin solid]", {"text-overflow": "ellipsis"}, item[column.field])
        }).concat(m("td[style=outline: thin solid]", {nowrap: true}, [
            m("button", {onclick: Grid.deleteItem.bind(ctrl, panelBuilder, item, index)}, "delete"),
            m("button", {onclick: Grid.editItem.bind(ctrl, panelBuilder, item, index)}, "edit"),
            m("button", "view")
        ])));
    }
};

var ItemPanel = {
    controller: function(args) {
        console.log("%%%%%%%%%%%%%%%%%%% ItemPanel controller called");
        // TODO: just seeing "placeholder" and view not called the first time; figure out why??
        // https://lhorie.github.io/mithril/mithril.component.html
        // TODO: Seem to need to queue a redraw to get the component rendered the first time (and not call directly to avoid endless recursion)
        // TODO: However, this is not needed if the entire larger component assembly is "mounted". Maybe Mithril bug?
        setTimeout(args.panelBuilder.redraw, 0);
    },
    
    view: function(ctrl, args) {
        console.log("%%%%%%%%%%%%%%%%%%% ItemPanel view called");
        // return m("div", "work in progress");
        // TODO: Should provide copy of item?
        var panelBuilder: PanelBuilder = args.panelBuilder;
        // Possible recursion if the panels contain a table
        return m("div", panelBuilder.buildPanel(args.grid.itemPanelSpecification, null, args.item))

    }
}
    

export function add_grid(panelBuilder, model, fieldSpecification) {

    return m.component(<any>Grid, {panelBuilder: panelBuilder, model: model, fieldSpecification: fieldSpecification});
}