import storyCardDisplay = require("../storyCardDisplay");
import questionnaireGeneration = require("../questionnaireGeneration");
import surveyCollection = require("../surveyCollection");
import valuePathResolver = require("../panelBuilder/valuePathResolver");
import PanelBuilder = require("../panelBuilder/PanelBuilder");
import Project = require("../Project");
import Globals = require("../Globals");
import m = require("mithril");
import GridWithItemPanel = require("../panelBuilder/GridWithItemPanel");

"use strict";

// story browser support

// TODO: Need to update answer counts in filters if change value in story that affectes selected filter question

// TODO: Translate
var unansweredIndicator = "{Unanswered}";

function isMatch(story: surveyCollection.Story, questionChoice, selectedAnswerChoices) {
    if (!questionChoice) return true;
    var questionAnswer = story.fieldValue(questionChoice.id);
    if (questionAnswer === undefined || questionAnswer === null || questionAnswer === "") {
        questionAnswer = unansweredIndicator;
    } else if (typeof questionAnswer === "object") {
        // checkboxes
        for (var key in questionAnswer) {
            if (selectedAnswerChoices[key] && questionAnswer[key]) return true;
        }
        return false;
    }
    questionAnswer = "" + questionAnswer;
    return !!selectedAnswerChoices[questionAnswer];
}
    
function optionsFromQuestion(question, stories) {
    // TODO: Translate text for options, at least booleans?
    var options = [];
    
    if (!question) return options;
    
    // Compute how many of each answer -- assumes typically less than 200-1000 stories
    var totals = {};
    stories.forEach(function(story: surveyCollection.Story) {
        var choice = story.fieldValue(question.id);
        if (choice === undefined || choice === null || choice === "") {
            // Do not include "0" as unanswered
            choice = unansweredIndicator;
        }
        var oldValue;
        if (question.displayType === "checkboxes") {
            for (var key in choice) {
                oldValue = totals[key];
                if (!oldValue) oldValue = 0;
                if (choice[key]) totals[key] = oldValue + 1; 
            }
        } else {
            oldValue = totals[choice];
            if (!oldValue) oldValue = 0;
            totals[choice] = oldValue + 1;
        }
    });
    
    var count;
    
    if (question.displayType === "select") {
        question.valueOptions.forEach(function(each) {
            count = totals[each];
            if (!count) count = 0;
            options.push({label: each + " (" +  count + ")", value: each});
        });
    } else if (question.displayType === "radiobuttons") {
        question.valueOptions.forEach(function(each) {
            count = totals[each];
            if (!count) count = 0;
            options.push({label: each + " (" +  count + ")", value: each});
        });
    } else if (question.displayType === "checkboxes") {
        question.valueOptions.forEach(function(each) {
            count = totals[each];
            if (!count) count = 0;
            options.push({label: each + " (" +  count + ")", value: each});
        });
    } else if (question.displayType === "slider") {
        for (var sliderTick = 0; sliderTick <= 100; sliderTick++) {
            count = totals[sliderTick];
            if (!count) count = 0;
            var sliderTickText = "" + sliderTick;
            /*
            if (sliderTickText.length < 2) {
                sliderTickText = "0" + sliderTickText;
            }
            if (sliderTickText.length < 3) {
                sliderTickText = "0" + sliderTickText;
            }
            */
            options.push({label: sliderTickText + " (" +  count + ")", value: sliderTick});
        }
    } else if (question.displayType === "boolean") {
        // TODO; Not sure this will really be right with true/false as booleans instead of strings
        ["true", "false"].forEach(function(each) {
            count = totals[each];
            if (!count) count = 0;
            options.push({label: each + " (" +  count + ")", value: each});
        });
    } else if (question.displayType === "checkbox") {
        // TODO; Not sure this will really be right with true/false as checkbox instead of strings
        [true, false].forEach(function(each) {
            count = totals["" + each];
            if (!count) count = 0;
            options.push({label: each + " (" +  count + ")", value: each});
        });
    } else if (question.displayType === "text") {
        for (var eachTotal in totals) {
            if (totals.hasOwnProperty(eachTotal)) {
                count = totals[eachTotal];
                if (!count) count = 0;
                options.push({label: eachTotal + " (" +  count + ")", value: eachTotal});                    
            }
        }
    } else {
        console.log("ERROR: question type not supported: ", question.displayType, question);
        options.push({label: "*ALL*" + " (" +  stories.length + ")", value: "*ALL*"});
    }
    
    // TODO: Maybe should not add the unanswered indicator if zero?
    // Always add the unanswered indicator if not checkboxes or checkbox
    if (question.displayType !== "checkbox" && question.displayType !== "checkboxes") {
        count = totals[unansweredIndicator];
        if (!count) count = 0;
        options.push({label: unansweredIndicator + " (" +  count + ")", value: unansweredIndicator});
    }
    
    /*
    // Sort options by their name -- only if not slider numbers which are already ordered
    if (question.displayType !== "slider") {
        options.sort(function(a, b) {
            if (a.label.toLowerCase() < b.label.toLowerCase()) return -1;
            if (a.label.toLowerCase() > b.label.toLowerCase()) return 1;
            return 0;
        });
    }
    */
    
    return options;
}

function getSelectedOptions(select) {
    var selectedOptions = {};
    
    // select.selectedOptions is probably not implemented widely enough, so use this looping code instead over all options
    for (var i = 0; i < select.options.length; i++) {
        var option = select.options[i];
        
        if (option.selected) {
            selectedOptions[option.value] = option;
        }
    }
    
    return selectedOptions;
}

class Filter {
    name: string = null;
    storyBrowser: StoryBrowser = null;
    selectedQuestion = null;
    answerOptionsForSelectedQuestion = [];
    selectedAnswers = {};
    
    constructor(args) {
        this.storyBrowser = args.storyBrowser;
        this.name = args.name;
    }
    
    static controller(args) {
        return new Filter(args);
    }
    
    static view(controller, args) {
        return controller.calculateView();
    }

    hasQuestionAndAnswers() {
        return this.selectedQuestion && Object.keys(this.selectedAnswers).length;
    }

    displayInformation() {
        var result = "";
        if (this.hasQuestionAndAnswers()) {
            result += this.selectedQuestion.displayName + ": ";
            result += Object.keys(this.selectedAnswers).join(", ");
        }
    return result;
    }
        
    calculateView() {
        var choices = this.storyBrowser.choices || [];
        var selectOptions = choices.map((option) => {
            var optionOptions = {value: option.value, selected: undefined};
            if (this.selectedQuestion === option.value) optionOptions.selected = 'selected';
            return m("option", optionOptions, option.label);
        });
        
        var isNoSelection = (this.selectedQuestion === null) || undefined;
        selectOptions.unshift(m("option", {value: "", selected: isNoSelection}, "--- no filter ---"));
        
        var multiselectOptions = this.answerOptionsForSelectedQuestion.map((option) => {
            var optionOptions = {value: option.value, selected: undefined};
            if (this.selectedAnswers[option.value]) optionOptions.selected = 'selected';
            return m("option", optionOptions, option.label);
        });
        
        var isClearButtonDisabled = (this.selectedQuestion === null) || undefined;
        var displayOrNotText = (multiselectOptions.length > 0) ? "" : "[style='display:none']";
         
        return m("div.filter", [
            this.name,
            m("br"),
            m("select", {onchange: this.filterPaneQuestionChoiceChanged.bind(this)}, selectOptions),
            m("button", {disabled: isClearButtonDisabled, onclick: this.clearFilterPane.bind(this)}, "Clear"),
            m("br"),
            m("select" + displayOrNotText, {onchange: this.filterPaneAnswerChoiceChanged.bind(this), multiple: "multiple"}, multiselectOptions)
        ]);
    }
    
    filterPaneQuestionChoiceChanged(event) {
        var question = getQuestionDataForSelection(this.storyBrowser.questions, event);
        
        this.selectedQuestion = question;
        this.answerOptionsForSelectedQuestion = optionsFromQuestion(this.selectedQuestion, this.storyBrowser.allStories);
        this.selectedAnswers = {};
        
        this.storyBrowser.setStoryListForCurrentFilters();  
    }
    
    filterPaneAnswerChoiceChanged(event) {
        this.selectedAnswers = getSelectedOptions(event.target);        
        this.storyBrowser.setStoryListForCurrentFilters();
    }
    
    resetChoices() {
        this.selectedQuestion = null;
        this.answerOptionsForSelectedQuestion = [];
        this.selectedAnswers = {};
    }     
        
    clearFilterPane() {
        this.resetChoices();
        this.storyBrowser.setStoryListForCurrentFilters();
    }
}

function getQuestionDataForSelection(questions, event) {
    var newValue = event.target.value;
     
    var question = null;
    
    for (var index = 0; index < questions.length; index++) {
        var questionToCheck = questions[index];
        if (questionToCheck.id === newValue) {
            question = questionToCheck;
            break;
        }
    }
    
    //console.log("filterPaneQuestionChoiceChanged", question);
    
    if (!question && newValue) console.log("could not find question for id", newValue);
    
    return question; 
}

class StoryBrowser {
    project: Project = null;
    storyCollectionIdentifier: string = null;
    questionnaire: null;
    questions = [];
    choices = [];
    allStories = [];
    filteredStories = [];
    itemPanelSpecification = {id: "temporary", modelClass: "Story", panelFields: []};
    gridFieldSpecification = null;
    
    // Embedded components
    filter1: Filter;
    filter2: Filter;
    
    grid: GridWithItemPanel = null;
    
    constructor(args) {   
        this.project = Globals.project();
        this.gridFieldSpecification = {
            id: "stories",
            displayConfiguration: {
                itemPanelSpecification: this.itemPanelSpecification,
                gridConfiguration: {
                    idProperty: "storyID",
                    columnsToDisplay: ["storyName", "storyText", "ignore"],
                    viewButton: true,
                    editButton: true,
                    navigationButtons: true
               }
            }
        };
        
        this.filter1 = new Filter({key: "First filter", name: "First filter", storyBrowser: this});
        this.filter2 = new Filter({key: "Second filter", name: "Second filter", storyBrowser: this});
        this.grid = new GridWithItemPanel({panelBuilder: args.panelBuilder, model: this, fieldSpecification: this.gridFieldSpecification});
    }

    static controller(args) {
        return new StoryBrowser(args);
    }
    
    static view(controller, args) {
        return controller.calculateView(args);
    }
    
    calculateView(args) {
        var panelBuilder = args.panelBuilder;
        
        // Handling of caching of questions and stories
        var storyCollectionIdentifier = valuePathResolver.newValuePathForFieldSpecification(args.model, args.fieldSpecification)();
        if (storyCollectionIdentifier !== this.storyCollectionIdentifier) {
            // TODO: Maybe need to handle tracking if list changed so can keep sorted list?
            this.storyCollectionIdentifier = storyCollectionIdentifier;
            this.currentStoryCollectionChanged(this.storyCollectionIdentifier);
            
            // What to do about resetting the filters?
            this.filter1.resetChoices();
            this.filter2.resetChoices();
            
            // Need to update grid for change
            this.gridFieldSpecification.displayConfiguration.itemPanelSpecification = this.itemPanelSpecification;
            this.filteredStories = this.allStories;
            this.grid.updateDisplayConfigurationAndData(this.gridFieldSpecification.displayConfiguration);
        }
        
        var promptText = panelBuilder.addAllowedHTMLToPrompt(args.fieldSpecification.displayPrompt) + " (" + this.allStories.length + ")";
        var prompt =  m("span", {"class": "questionPrompt"}, promptText);
        
        var parts;
        
        if (!this.storyCollectionIdentifier) {
            parts = [m("div", "Please select a story collection to view")];
        } else {
            var filter = m("table.filterTable", m("tr", [
                m("td", this.filter1.calculateView()),
                m("td", this.filter2.calculateView())
            ]));

            var filterInfoString = "Stories ";
            var filter1HasSelections = this.filter1.hasQuestionAndAnswers();
            var filter2HasSelections = this.filter2.hasQuestionAndAnswers();

            if (filter1HasSelections || filter2HasSelections) filterInfoString += " filtered by ";
            if (filter1HasSelections) filterInfoString += this.filter1.displayInformation();
            if (filter1HasSelections && filter2HasSelections) filterInfoString += " and ";
            if (filter2HasSelections) filterInfoString += this.filter2.displayInformation();

            // TODO: Translation
            var filteredCountText = m("div.narrafirma-story-browser-filtered-stories-count", filterInfoString + " (" + this.filteredStories.length + ")");

            parts = [prompt, filter, filteredCountText, this.grid.calculateView()];
        }
        
        return m("div", {"class": "questionExternal narrafirma-question-type-questionAnswer"}, parts);
    }
    
    // Not using m.prop for stories property as it makes debugging harder?
    stories() {
        return this.filteredStories;
    }
    
    currentStoryCollectionChanged(storyCollectionIdentifier) {
        this.questions = [];
        this.storyCollectionIdentifier = storyCollectionIdentifier;
        this.questionnaire = surveyCollection.getQuestionnaireForStoryCollection(storyCollectionIdentifier);

        var storyNameAndTextQuestions = questionnaireGeneration.getStoryNameAndTextQuestions()
        
        var elicitingQuestion = this.project.elicitingQuestionForStoryCollection(this.storyCollectionIdentifier);
        var numStoriesToldQuestions = this.project.numStoriesToldQuestionForStoryCollection(this.storyCollectionIdentifier);

        var storyQuestions = this.project.storyQuestionsForStoryCollection(this.storyCollectionIdentifier);
        var participantQuestions = this.project.participantQuestionsForStoryCollection(this.storyCollectionIdentifier);
        // annotations are not per collection/questionnaire
        var annotationQuestions = questionnaireGeneration.convertEditorQuestions(this.project.collectAllAnnotationQuestions(), "A_");
        
        this.questions = this.questions.concat(storyNameAndTextQuestions, [elicitingQuestion], annotationQuestions, storyQuestions, participantQuestions, numStoriesToldQuestions);

        this.choices = surveyCollection.optionsForAllQuestions(this.questions);
        this.allStories = surveyCollection.getStoriesForStoryCollection(storyCollectionIdentifier, true);
        
        this.itemPanelSpecification = this.makeItemPanelSpecificationForQuestions(this.questions);
        
        this.itemPanelSpecification.panelFields.push({
            id: "ignore",
            valueType: "string",
            displayType: "text",
            displayName: "Ignore",
            displayPrompt: "Reason to ignore story (enter any text here to leave this story out of all graphs and reports)",
            displayClass: "narrafirma-ignore-story"
        });
        
        /*
        // TODO: What to do about current selection in filter widgets?
        
        // Update item panel in grid
        this.storyList.changeItemPanelSpecification(itemPanelSpecification);
        
        this.loadLatestStories(allStories);
        
        // TODO: Should close up open grid view
        */
    }
    
    buildStoryDisplayPanel(panelBuilder: PanelBuilder, storyModel: surveyCollection.Story) {
        var storyDisplay;
        if (panelBuilder.readOnly) {
            // override questionnaire pointed to by storyModel because it may have been updated using the "update story form" button
            storyDisplay = storyCardDisplay.generateStoryCardContent(storyModel, undefined, {"location": "storyBrowser", "questionnaire": this.questionnaire});
        } else {
            storyDisplay = panelBuilder.buildFields(this.questions, storyModel);
        }
        
        return storyDisplay;
    }
    
    makeItemPanelSpecificationForQuestions(questions) {
        // TODO: add more participant and survey info, like timestamps and participant ID
        
        var itemPanelSpecification = {
            id: "storyBrowserQuestions",
            modelClass: "Story",
            panelFields: questions,
            buildPanel: this.buildStoryDisplayPanel.bind(this)
        };
        
        return itemPanelSpecification;
    }
    
    getFilteredStoryList() {
        var question1Choice = this.filter1.selectedQuestion;
        var answers1Choices = this.filter1.selectedAnswers;
        var question2Choice = this.filter2.selectedQuestion;
        var answers2Choices = this.filter2.selectedAnswers;
        var filterFunction = function (item) {
            var match1 = isMatch(item, question1Choice, answers1Choices);
            var match2 = isMatch(item, question2Choice, answers2Choices);
            return match1 && match2;
        };
        
        var filteredResults = this.allStories.filter(filterFunction);
        return filteredResults;
    }
    
    setStoryListForCurrentFilters() {
        var filteredResults = this.getFilteredStoryList();
        this.filteredStories = filteredResults;
        this.grid.updateData();
    }
    
    /* TODO: Probably need to implement something like this
    function loadLatestStories(storyBrowserInstance, allStories) {
        storyBrowserInstance.dataStore.setData(allStories);
        
        // Need to update choices in filters or clear them out; reettign value forces update
        filterPaneQuestionChoiceChanged(storyBrowserInstance.filter1, storyBrowserInstance.filter1.questionSelect.get("value"));
        filterPaneQuestionChoiceChanged(storyBrowserInstance.filter2, storyBrowserInstance.filter2.questionSelect.get("value"));
        
        setStoryListForCurrentFilters(storyBrowserInstance);
    }
    */
}

export = StoryBrowser;