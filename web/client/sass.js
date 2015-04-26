window.qira = window.qira || {};
var qira = window.qira;
var rb = window.ReactBootstrap;

qira.formatAddress = function(address, offset) {
    var pmaps = Session.get("pmaps");

    if(offset !== undefined) {
        var addressInt = parseInt(address) + parseInt(offset);
        address = "0x" + addressInt.toString(16);
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
        return {name: "", target: "", value:"", type:"memory", size: 4};
    },
    getForms: function() {
        if(this.state.type === "memory") {
            return (
                React.createElement("div", null, 
                    React.createElement("div", {className: "row"}, 
                        React.createElement(rb.Col, {xs: 9}, 
                            React.createElement(rb.Input, {type: "text", className: "ignore", label: "Address", valueLink: this.linkState('target'), placeholder: ""})
                        ), 
                        React.createElement(rb.Col, {xs: 3}, 
                            React.createElement(rb.Input, {type: "number", className: "ignore", label: "Size", valueLink: this.linkState('size'), placeholder: ""})
                        ), 
                        React.createElement(rb.Col, {xs: 12}, 
                            React.createElement(rb.Input, {type: "text", className: "ignore", label: "Value", valueLink: this.linkState('value'), placeholder: ""})
                        )
                    )
                ));
        } else {
            return React.createElement("div", null, 
            React.createElement(rb.Input, {type: "text", className: "ignore", label: "Value", valueLink: this.linkState('value'), placeholder: ""})
            );
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
        return React.createElement("div", null, React.createElement(rb.Label, {bsStyle: "primary"}, "MEM"), " ", link, " ", arrow, " ", qira.formatAddress(constraint.value), 
            React.createElement(rb.Badge, {className: "pull-right"}, "Size: ", constraint.size)
        );
    },
    createRegisterConstraint: function(constraint) {
        var link = React.createElement("span", {className: "register"}, constraint.target);
        var arrow = React.createElement("i", {className: "fa fa-long-arrow-right"});
        return React.createElement("div", null, React.createElement(rb.Label, {bsStyle: "info"}, "REG"), " ", link, " ", arrow, " ", qira.formatAddress(constraint.value));
    },
    header: function () {
        var modal = React.createElement(qira.sassAddConstraintModal, {container: this, onAdd: this.props.onAdd});

        var addButton = React.createElement("div", {className: "modal-container pull-right"}, 
            React.createElement(rb.ModalTrigger, {modal: modal, container: this}, 
                React.createElement(rb.Button, {bsSize: "xsmall"}, React.createElement("i", {className: "fa fa-plus"}))
            ));

        return (
            React.createElement("h4", {className: "panel-title"}, 
                "Constraints ", addButton
            ));
    },
    render: function() {
        var constraintItems = this.props.constraints.map(this.createConstraint);

        if(constraintItems.length === 0) {
           constraintItems = React.createElement("p", null, "To take advantage of the constraint solver add some constraints above.");
        }

        return (
            React.createElement("div", {className: "bs"}, 
                React.createElement(rb.Panel, {header: this.header()}, 
                    React.createElement("ul", {className: "list-group"}, 
                        constraintItems
                    )
                )
            ));
    }
});

qira.sassAddSymbolicModal = React.createClass({displayName: "sassAddSymbolicModal",
    mixins: [React.addons.LinkedStateMixin],
    getInitialState: function() {
        return {name: "", target: "", size: 4, type: "memory"};
    },
    getForms: function() {
        if(this.state.type === "memory") {
            return React.createElement("div", {className: "row"}, 
                React.createElement(rb.Col, {xs: 9}, 
                    React.createElement(rb.Input, {type: "text", className: "ignore", label: "Address", valueLink: this.linkState('target'), placeholder: ""})
                ), 
                React.createElement(rb.Col, {xs: 3}, 
                    React.createElement(rb.Input, {type: "number", className: "ignore", label: "Size", valueLink: this.linkState('size'), placeholder: ""})
                )
            );
        } else {
            return React.createElement("div", null);
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

        return React.createElement(rb.Modal, React.__spread({},  this.props, {className: "bs", bsStyle: "primary", title: "Add a symbolic value", animation: false}), 
                React.createElement("div", {className: "modal-body"}, 
                    React.createElement("form", null, 
                        React.createElement(rb.Input, {type: "select", label: "Symbolic type", valueLink: this.linkState('type')}, 
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

qira.sassSymbolicPanel = React.createClass({displayName: "sassSymbolicPanel",
    createSymbolic: function(symbolic) {
        var deleteButton = React.createElement("i", {className: "fa fa-remove pull-right", onClick: this.props.onDelete.bind(this, symbolic)});
        var symbolicType = symbolic.type == "memory" ? this.createMemorySymbolic : this.createRegisterSymbolic;
        return (React.createElement(rb.ListGroupItem, {className: "fill"}, deleteButton, " ", symbolicType(symbolic)));
    },
    createMemorySymbolic: function(symbolic) {
        var link = qira.formatAddress(symbolic.target);
        var arrow = React.createElement("i", {className: "fa fa-long-arrow-right"});
        return (
        React.createElement("div", null, 
            React.createElement(rb.Label, {bsStyle: "primary"}, "MEM"), " ", link, " ", arrow, " ", qira.formatAddress(symbolic.target, symbolic.size), 
            React.createElement(rb.Badge, {className: "pull-right"}, "Size: ", symbolic.size)
        ));
    },
    createRegisterSymbolic: function(symbolic) {
        var link = React.createElement("span", {className: "register"}, symbolic.target);
        return React.createElement("div", null, React.createElement(rb.Label, {bsStyle: "info"}, "REG"), " ", link);
    },
    header: function () {
        var modal = React.createElement(qira.sassAddSymbolicModal, {container: this, onAdd: this.props.onAdd});

        var addButton = React.createElement("div", {className: "modal-container pull-right"}, 
            React.createElement(rb.ModalTrigger, {modal: modal, container: this}, 
                React.createElement(rb.Button, {bsSize: "xsmall"}, React.createElement("i", {className: "fa fa-plus"}))
            ));

        return (React.createElement("h4", {className: "panel-title"}, 
             "Symbolic ", addButton
                ));
    },
    render: function() {
        var symbolicItems = this.props.symbolics.map(this.createSymbolic);

        if(symbolicItems.length === 0) {
           symbolicItems = React.createElement("p", null, "To take advantage of the symbolic solver add some symbolics regions above.");
        }
        return (
            React.createElement("div", {className: "bs"}, 
                React.createElement(rb.Panel, {header: this.header()}, 
                    React.createElement("ul", {className: "list-group"}, 
                        symbolicItems
                    )
                )
            ));
    }
});

qira.sassSolverPanel = React.createClass({displayName: "sassSolverPanel",
    getInitialState: function() {
        return {stream: undefined, status: "waiting", results: undefined};
    },
    header: function () {
        var modal = React.createElement(qira.sassAddSymbolicModal, {container: this, onAdd: this.props.onAdd});
        var buttons =
        React.createElement(rb.ButtonToolbar, {className: "pull-right"}, 
                React.createElement(rb.Button, {bsSize: "xsmall", onClick: this.props.onStart.bind(this, this.state.stream), bsStyle: "success"}, "Start"), 
                React.createElement(rb.Button, {bsSize: "xsmall", onClick: this.props.onStop.bind(this, this.state.stream), bsStyle: "primary"}, "Stop")
        );

        return (
            React.createElement("h4", {className: "panel-title"}, 
                "Symbolic Solver ", buttons
            ));
    },
    componentDidMount: function() {
        var newState = {stream: io.connect(STREAM_URL), status: "waiting"};
        this.setState(newState);
        newState.stream.on("sassstatus", function(sassStatus, results) {
            var newState = React.addons.update(this.state, {
                status: {$set: sassStatus},
                results: {$set: results}
            });
            this.setState(newState);
        }.bind(this));
    },
    makeDisplay: function() {
        var solverStatus = this.state.status;
        if(solverStatus === "waiting") {
            return React.createElement("h2", null, "Waiting to begin.");
        } else if(solverStatus === "running") {
            return React.createElement("h2", null, "Solving... ", React.createElement("i", {className: "fa fa-spinner fa-spin"}));
        } else if(solverStatus === "results") {
            return React.createElement("h2", null, this.state.results);
        }
    },
    render: function() {
        return React.createElement("div", {className: "bs"}, 
                React.createElement(rb.Panel, {header: this.header()}, 
                    React.createElement(rb.Col, {xs: 3}, 
                        React.createElement(rb.Input, {type: "text", className: "ignore", label: "Starting clnum", 
                                  onChange: this.props.onClnumChange, value: this.props.data.options.clnum, placeholder: ""})
                    ), 
                    React.createElement(rb.Col, {xs: 9}, 
                        this.makeDisplay()
                    )
                )
        );
    }
});

qira.sassApp = React.createClass({displayName: "sassApp",
    getInitialState: function() {
        return {
            symbolics: [{name: "testa", type: "register", target: "RAX", size: 0},
                       {name: "testb", type: "memory", target: "0x40007ffea0", size: 16}],
            constraints: [{name: "test1", type: "register", target: "RIP", value: "0x1337beef", size: 4},
                          {name: "test2", type: "memory", target: "0x4005cc", value: "0xcoffee", size: 4},
                          {name: "test3", type: "memory", target: "0x40007ffea0", value: "0xcoffee13371337", size:8}],
            //We should eventually add threading, assists, etc. here
            options: {clnum: 0},
        };
    },
    handleConstraintDelete: function(constraint) {
        var newConstraints = _.reject(this.state.constraints, function (item) {
            return item == constraint;
        });
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
    handleSymbolicDelete: function(symbolic) {
        var newSymbolics = _.reject(this.state.symbolics, function (item) {
            return item == symbolic;
        });
        this.setState({symbolics: newSymbolics});
    },
    onClnumChange: function(e) {
        var newState = React.addons.update(this.state, {
            options: {clnum: {$set: e.target.value}}
        });
        this.setState(newState);
    },
    onSymbolicAdd: function(symbolic) {
        // Right now we are only supporting concrete values.
        // However, in the future, we should not enforce uniqueness
        // naively as it would be great to be able to constrain values
        // to some range, equality, etc.
        if(symbolic.type !== "memory") {
            symbolic.target = symbolic.type;
            symbolic.type = "register";
        }
        var newSymbolics = this.state.symbolics.concat(symbolic);
        this.setState({symbolics: newSymbolics});
    },
    formatSolverState: function() {
        var sassState = {
            start: this.state.options.clnum,
            symbolic: {
                registers: [],
                memory: {}
            },
            constraints: {
                registers: {},
                memory: {}
            }
        };

        var groupByType = function(data) {
            return _.groupBy(data, function(e) {
                return e.type;
            });
        };

        var symbolics = groupByType(this.state.symbolics);

        sassState.symbolic.registers = _.map(symbolics.register, function(reg) { return reg.target; });
        sassState.symbolic.memory = _.map(symbolics.memory, function(mem) {
            return {address: parseInt(mem.target), size: mem.size};
        });

        var constraints = groupByType(this.state.constraints);

        sassState.constraints.registers = _.map(constraints.register, function(reg) {
            return {name: reg.target, value: reg.value};
        });

        sassState.constraints.memory = _.map(constraints.memory, function(mem) {
            return {address: parseInt(mem.target), value: parseInt(mem.value), size: mem.size};
        });

        //We do not support this in the ui at this time.
        sassState.assist = {};

        return sassState;
    },
    onSolverStart: function(stream) {
        console.log("starting solver");
        stream.emit("startsolver", Session.get("forknum"), this.formatSolverState());
    },
    onSolverStop: function(stream) {
        console.log("stopping solver");
        var newState = React.addons.update(this.state, {
            status: {$set: "waiting"}
        });
        this.setState(newState);
    },
    render: function() {
        var constraintPanel = React.createElement(qira.sassConstraintPanel, {
                onDelete: this.handleConstraintDelete, 
                onAdd: this.onConstraintAdd, 
                constraints: this.state.constraints});

        var symbolicPanel = React.createElement(qira.sassSymbolicPanel, {
                onDelete: this.handleSymbolicDelete, 
                onAdd: this.onSymbolicAdd, 
                symbolics: this.state.symbolics});

        var solverPanel = React.createElement(qira.sassSolverPanel, {
                data: this.state, 
                onClnumChange: this.onClnumChange, 
                onStart: this.onSolverStart, 
                onStop: this.onSolverStop});

        return (
            React.createElement("div", {className: "bs fill"}, 
                React.createElement(rb.TabbedArea, {defaultActiveKey: 1}, 
                    React.createElement(rb.TabPane, {eventKey: 1, tab: "Constraints"}, constraintPanel), 
                    React.createElement(rb.TabPane, {eventKey: 2, tab: "Symbolics"}, symbolicPanel), 
                    React.createElement(rb.TabPane, {eventKey: 3, tab: "Solver"}, solverPanel)
                )
            ));
  }
});

