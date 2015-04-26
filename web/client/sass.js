window.qira = window.qira || {};
var qira = window.qira;
var rb = window.ReactBootstrap;

qira.formatAddress = function(address) {
    var pmaps = Session.get("pmaps");

    if(pmaps === undefined) {
        console.log("pmaps undefined");
    }

    var mapAddresses = _.keys(pmaps);
    var ranges = _.sortBy(_.map(mapAddresses, function(addr) {
        return {label: addr, value: parseInt(addr)};
    }));

    var type = "unknown";
    for(var i = 1; i < ranges.length; i++) {
        var mapAddress = ranges[i].value;
        if(mapAddress > parseInt(address)) {
            if(i > 0) {
                type = pmaps[ranges[i-1].label];
                break;
            }
        }
    }

    // Lookup table for type -> class names
    if(type === "memory") type = "datamemory";
    else if(type === "instruction") type = "insaddr";

    return React.createElement("span", {className: type + " addr addr_" + address}, address);
};

qira.sassAddConstraintModal = React.createClass({displayName: "sassAddConstraintModal",
    mixins: [React.addons.LinkedStateMixin],
    getInitialState: function() {
        return {name: "", target: "", value:"", type:"memory"};
    },
    getForms: function() {
        if(this.state.type === "memory") {
            return React.createElement("div", null, 
            React.createElement(rb.Input, {type: "text", className: "ignore", label: "Address", valueLink: this.linkState('target'), placeholder: ""}), 
            React.createElement(rb.Input, {type: "text", className: "ignore", label: "Value", valueLink: this.linkState('value'), placeholder: ""})
            )
        } else {
            return React.createElement("div", null, 
            React.createElement(rb.Input, {type: "text", className: "ignore", label: "Value", valueLink: this.linkState('value'), placeholder: ""})
            )
        }
    },
    onAddThenClose: function(state) {
        this.props.onAdd.bind(this, state)();
        this.props.onRequestHide();
    },
    render: function() {
        var registerOptions = Session.get("registers").map(function(register) {
            return React.createElement("option", {value: register.name}, register.name);
        });
        
        return React.createElement(rb.Modal, React.__spread({},  this.props, {className: "bs", bsStyle: "primary", title: "Add a constraint", animation: false}), 
        React.createElement("div", {className: "modal-body"}, 
        React.createElement("form", null, 
        React.createElement(rb.Input, {type: "select", label: "Constraint type", valueLink: this.linkState('type')}, 
        React.createElement("option", {value: "memory", selected: true}, "Memory"), 
        registerOptions
        ), 
        this.getForms()
        )
        ), 
        React.createElement("div", {className: "modal-footer"}, 
        React.createElement(rb.Button, {onClick: this.props.onRequestHide}, "Close"), 
        React.createElement(rb.Button, {onClick: this.onAddThenClose.bind(this, this.state)}, "Add")
        )
        );
    }
});

qira.sassConstraintPanel = React.createClass({displayName: "sassConstraintPanel",
    createConstraint: function(constraint) {
        var deleteButton = React.createElement("i", {className: "fa fa-remove pull-right", onClick: this.props.onDelete.bind(this, constraint)});
        var constraintType = constraint.type == "memory" ? this.createMemoryConstraint : this.createRegisterConstraint;
        return (React.createElement(rb.ListGroupItem, {className: "fill"}, deleteButton, " ", constraintType(constraint)));
    },
    createMemoryConstraint: function(constraint) {
        var link = qira.formatAddress(constraint.target);
        var arrow = React.createElement("i", {className: "fa fa-long-arrow-right"});
        return React.createElement("div", null, React.createElement(rb.Label, {bsStyle: "primary"}, "MEM"), " ", link, " ", arrow, " ", qira.formatAddress(constraint.value));
    },
    createRegisterConstraint: function(constraint) {
        var link = React.createElement("span", {className: "register"}, constraint.target);
        var arrow = React.createElement("i", {className: "fa fa-long-arrow-right"});
        return React.createElement("div", null, React.createElement(rb.Label, {bsStyle: "info"}, "REG"), " ", link, " ", arrow, " ", qira.formatAddress(constraint.value));
    },
    header: function () {
        var modal = React.createElement(qira.sassAddConstraintModal, {container: this, onAdd: this.props.onAdd});
        return (React.createElement("div", null, 
             "Constraints", 
                  React.createElement("div", {className: "modal-container"}, 
                  React.createElement(rb.ModalTrigger, {modal: modal, container: this}, 
                  React.createElement(rb.Button, {bsSize: "xsmall"}, React.createElement("i", {className: "fa fa-plus"}))
             )
              )
                ));
    },
    render: function() {
        var constraintItems = this.props.constraints.map(this.createConstraint);
        if(constraintItems.length > 0) {
            return (React.createElement("div", {className: "bs"}, 
                React.createElement(rb.Panel, {header: this.header()}, 
                React.createElement("ul", {className: "list-group"}, 
                constraintItems
                )
                )
            ));
        } else {
            React.createElement("p", null, "To take advantage of the constraint solver add some constraints above.")
        }
    }
});

qira.sassApp = React.createClass({displayName: "sassApp",
    getInitialState: function() {
        return {
            constraints: [{name: "test1", type: "register", target: "RIP", value: "0x1337beef"},
                          {name: "test2", type: "memory", target: "0x4005cc", value: "0xcoffee"},
                          {name: "test3", type: "memory", target: "0x40007ffea0", value: "0xcoffee"}]
        };
    },
    handleConstraintDelete: function(constraint) {
        var newConstraints = _.reject(this.state.constraints, function (item) {
            console.log(constraint);
            console.log(item);
            return item == constraint;
        });
        console.log(newConstraints);
        this.setState({constraints: newConstraints});
    },
    onConstraintAdd: function(constraint) {
        // Right now we are only supporting concrete values.
        // However, in the future, we should not enforce uniqueness
        // naively as it would be great to be able to constrain values
        // to some range, equality, etc.
        if(constraint.type !== "memory") {
            constraint.target = constraint.type;
            constraint.type = "register";
        }
        var newConstraints = this.state.constraints.concat(constraint);
        this.setState({constraints: newConstraints});
    },
    render: function() {
        return (
                React.createElement("div", {className: "bs fill"}, 
                React.createElement(rb.Col, {xs: 6, className: "fill"}, 
                React.createElement(qira.sassConstraintPanel, {
                onDelete: this.handleConstraintDelete, 
                onAdd: this.onConstraintAdd, 
                constraints: this.state.constraints}), " ")
                ));
    }
});

