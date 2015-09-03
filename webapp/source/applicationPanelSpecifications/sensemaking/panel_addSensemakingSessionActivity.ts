import kludgeForUseStrict = require("../../kludgeForUseStrict");
"use strict";

var panel: Panel = {
    id: "panel_addSensemakingSessionActivity",
    displayName: "Add sensemaking session activity",
    displayType: "panel",
    section: "sensemaking",
    modelClass: "SensemakingSessionActivityPlan",
    panelFields: [
       {
            id: "order",
            valueType: "string",
            required: true,
            displayType: "text",
            displayName: "Order",
            displayPrompt: "Specify the order in which to do this sensemaking activity (e.g. 1, 2a, 2b, 3)"
        },
        {
            id: "sensemakingSessionPlan_activity_name",
            valueType: "string",
            required: true,
            displayType: "text",
            displayName: "Name",
            displayPrompt: "Please give this activity a <strong>name</strong>."
        },
        {
            id: "sensemakingSessionPlan_activity_type",
            valueType: "string",
            valueOptions: [
                "ice-breaker",
                "encountering stories (no task)",
                "encountering stories (simple task)",
                "discussing stories",
                "twice-told stories exercise",
                "timeline exercise",
                "landscape exercise",
                "story elements exercise",
                "composite stories exercise",
                "my own exercise",
                "other"
            ],
            required: true,
            displayType: "select",
            displayName: "Type",
            displayPrompt: "What <strong>type</strong> of activity is this?"
        },
        {
            id: "sensemakingSessionPlan_activity_plan",
            valueType: "string",
            required: true,
            displayType: "textarea",
            displayName: "Plan",
            displayPrompt: "Describe the <strong>plan</strong> for this activity."
        },
        {
            id: "sensemakingSessionPlan_activity_optionalParts",
            valueType: "string",
            required: true,
            displayType: "textarea",
            displayName: "Optional elaborations",
            displayPrompt: "Describe any optional <strong>elaborations</strong> you might or might not use in this activity."
        },
        {
            id: "sensemakingSessionPlan_activity_duration",
            valueType: "string",
            required: true,
            displayType: "text",
            displayName: "Length",
            displayPrompt: "<strong>How long</strong> will this activity take?"
        },
        {
            id: "sensemakingSessionPlan_activity_recording",
            valueType: "string",
            required: true,
            displayType: "textarea",
            displayName: "New stories",
            displayPrompt: "Will new stories be <strong>recorded</strong> during this activity? If so, how?"
        },
        {
            id: "sensemakingSessionPlan_activity_materials",
            valueType: "string",
            required: true,
            displayType: "textarea",
            displayName: "Materials",
            displayPrompt: "What materials (including catalytic materials, e.g., graphs and story cards) will this session plan require?"
        },
        {
            id: "sensemakingSessionPlan_activity_spaces",
            valueType: "string",
            required: true,
            displayType: "textarea",
            displayName: "Spaces",
            displayPrompt: "What <strong>spaces</strong> will be used for this activity?"
        },
        {
            id: "sensemakingSessionPlan_activity_facilitation",
            valueType: "string",
            required: true,
            displayType: "textarea",
            displayName: "Facilitation",
            displayPrompt: "What sort of <strong>facilitation</strong> will be necessary for this activity?"
        },
        {
            id: "templates_sensemakingActivities",
            valueType: "none",
            displayType: "templateList",
            displayConfiguration: "sensemakingActivities",
            displayPrompt: "Copy activity from template"
        }
    ]
};

export = panel;
