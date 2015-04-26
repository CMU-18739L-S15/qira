window.qira = window.qira || {};
var qira = window.qira;
var rb = window.ReactBootstrap;

qira.formatAddress = function(address, offset) {
    var pmaps = Session.get("pmaps");

    if(pmaps === undefined) {
        console.log("pmaps undefined");
    }

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

    return <span className = {type + " addr addr_" + address}>{address}</span>;
};

qira.sassAddConstraintModal = React.createClass({
    mixins: [React.addons.LinkedStateMixin],
    getInitialState: function() {
        return {name: "", target: "", value:"", type:"memory"};
    },
    getForms: function() {
        if(this.state.type === "memory") {
            return (
                <div>
                    <rb.Input type='text' className="ignore" label='Address' valueLink={this.linkState('target')}  placeholder=''/>
                    <rb.Input type='text' className="ignore" label='Value' valueLink={this.linkState('value')} placeholder=''/>
                </div>);
        } else {
            return <div>
            <rb.Input type='text' className="ignore" label='Value' valueLink={this.linkState('value')} placeholder=''/>
            </div>;
        }
    },
    onAddThenClose: function(state) {
        this.props.onAdd.bind(this, state)();
        this.props.onRequestHide();
    },
    render: function() {
        var registerOptions = Session.get("registers").map(function(register) {
            return <option value={register.name}>{register.name}</option>;
        });

        return <rb.Modal {...this.props} className="bs" bsStyle="primary" title="Add a constraint" animation={false}>
                <div className="modal-body">
                    <form>
                        <rb.Input type='select' label='Constraint type' valueLink={this.linkState('type')}>
                            <option value='memory' selected>Memory</option>
                            {registerOptions}
                        </rb.Input>
                        {this.getForms()}
                    </form>
                </div>
                <div className='modal-footer'>
                    <rb.Button onClick={this.props.onRequestHide}>Close</rb.Button>
                    <rb.Button onClick={this.onAddThenClose.bind(this, this.state)}>Add</rb.Button>
                </div>
        </rb.Modal>;
    }
});

qira.sassConstraintPanel = React.createClass({
    createConstraint: function(constraint) {
        var deleteButton = <i className="fa fa-remove pull-right" onClick={this.props.onDelete.bind(this, constraint)}></i>;
        var constraintType = constraint.type == "memory" ? this.createMemoryConstraint : this.createRegisterConstraint;
        return (<rb.ListGroupItem className="fill">{deleteButton} {constraintType(constraint)}</rb.ListGroupItem>);
    },
    createMemoryConstraint: function(constraint) {
        var link = qira.formatAddress(constraint.target);
        var arrow = <i className="fa fa-long-arrow-right"></i>;
        return <div><rb.Label bsStyle="primary">MEM</rb.Label> {link} {arrow} {qira.formatAddress(constraint.value)}</div>;
    },
    createRegisterConstraint: function(constraint) {
        var link = <span className = "register">{constraint.target}</span>;
        var arrow = <i className="fa fa-long-arrow-right"></i>;
        return <div><rb.Label bsStyle="info">REG</rb.Label> {link} {arrow} {qira.formatAddress(constraint.value)}</div>;
    },
    header: function () {
        var modal = <qira.sassAddConstraintModal container={this} onAdd={this.props.onAdd}/>;

        var addButton = <div className='modal-container pull-right'>
            <rb.ModalTrigger modal={modal} container={this}>
                <rb.Button bsSize='xsmall'><i className="fa fa-plus"></i></rb.Button>
            </rb.ModalTrigger></div>;

        return (
            <h4 className="panel-title">
                Constraints {addButton}
            </h4>);
    },
    render: function() {
        var constraintItems = this.props.constraints.map(this.createConstraint);

        if(constraintItems.length === 0) {
           constraintItems = <p>To take advantage of the constraint solver add some constraints above.</p>;
        }

        return (
            <div className="bs">
                <rb.Panel header={this.header()}>
                    <ul className="list-group">
                        {constraintItems}
                    </ul>
                </rb.Panel>
            </div>);
    }
});

qira.sassAddSymbolicModal = React.createClass({
    mixins: [React.addons.LinkedStateMixin],
    getInitialState: function() {
        return {name: "", target: "", size: 4, type: "memory"};
    },
    getForms: function() {
        if(this.state.type === "memory") {
            return <div className="row">
                <rb.Col xs={9}>
                    <rb.Input type='text' className="ignore" label='Address' valueLink={this.linkState('target')}  placeholder=''/>
                </rb.Col>
                <rb.Col xs={3}>
                    <rb.Input type='text' className="ignore" label='Size' valueLink={this.linkState('size')} placeholder=''/>
                </rb.Col>
            </div>;
        } else {
            return <div/>;
        }
    },
    onAddThenClose: function(state) {
        this.props.onAdd.bind(this, state)();
        this.props.onRequestHide();
    },
    render: function() {
        var registerOptions = Session.get("registers").map(function(register) {
            return <option value={register.name}>{register.name}</option>;
        });

        return <rb.Modal {...this.props} className="bs" bsStyle="primary" title="Add a symbolic value" animation={false}>
                <div className="modal-body">
                    <form>
                        <rb.Input type='select' label='Symbolic type' valueLink={this.linkState('type')}>
                            <option value='memory' selected>Memory</option>
                            {registerOptions}
                        </rb.Input>
                        {this.getForms()}
                    </form>
                </div>
                <div className='modal-footer'>
                    <rb.Button onClick={this.props.onRequestHide}>Close</rb.Button>
                    <rb.Button onClick={this.onAddThenClose.bind(this, this.state)}>Add</rb.Button>
                </div>
        </rb.Modal>;
    }
});

qira.sassSymbolicPanel = React.createClass({
    createSymbolic: function(symbolic) {
        var deleteButton = <i className="fa fa-remove pull-right" onClick={this.props.onDelete.bind(this, symbolic)}></i>;
        var symbolicType = symbolic.type == "memory" ? this.createMemorySymbolic : this.createRegisterSymbolic;
        return (<rb.ListGroupItem className="fill">{deleteButton} {symbolicType(symbolic)}</rb.ListGroupItem>);
    },
    createMemorySymbolic: function(symbolic) {
        var link = qira.formatAddress(symbolic.target);
        var arrow = <i className="fa fa-long-arrow-right"></i>;
        return <div><rb.Label bsStyle="primary">MEM</rb.Label> {link} {arrow} {qira.formatAddress(symbolic.target, symbolic.size)}</div>;
    },
    createRegisterSymbolic: function(symbolic) {
        var link = <span className = "register">{symbolic.target}</span>;
        return <div><rb.Label bsStyle="info">REG</rb.Label> {link}</div>;
    },
    header: function () {
        var modal = <qira.sassAddSymbolicModal container={this} onAdd={this.props.onAdd}/>;

        var addButton = <div className='modal-container pull-right'>
            <rb.ModalTrigger modal={modal} container={this}>
                <rb.Button bsSize='xsmall'><i className="fa fa-plus"></i></rb.Button>
            </rb.ModalTrigger></div>;

        return (<h4 className="panel-title">
             Symbolic {addButton}
                </h4>);
    },
    render: function() {
        var symbolicItems = this.props.symbolics.map(this.createSymbolic);

        if(symbolicItems.length === 0) {
           symbolicItems = <p>To take advantage of the symbolic solver add some symbolics regions above.</p>;
        }
        return (
            <div className="bs">
                <rb.Panel header={this.header()}>
                    <ul className="list-group">
                        {symbolicItems}
                    </ul>
                </rb.Panel>
            </div>);
    }
});

qira.sassSolverPanel = React.createClass({
    getInitialState: function() {
        return {stream: undefined, status: "waiting", results: undefined};
    },
    header: function () {
        var modal = <qira.sassAddSymbolicModal container={this} onAdd={this.props.onAdd}/>;
        var buttons =
        <rb.ButtonToolbar className="pull-right">
                <rb.Button bsSize="xsmall" onClick={this.props.onStart.bind(this, this.state.stream)} bsStyle="success">Start</rb.Button>
                <rb.Button bsSize="xsmall" onClick={this.props.onStop.bind(this, this.state.stream)} bsStyle='primary'>Stop</rb.Button>
        </rb.ButtonToolbar>;

        return (
            <h4 className="panel-title">
                Symbolic Solver {buttons}
            </h4>);
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
            return <h2>Waiting to begin.</h2>;
        } else if(solverStatus === "running") {
            return <h2>Solving... <i className="fa fa-plus fa-spin"></i></h2>;
        } else if(solverStatus === "results") {
            return <h2>{this.state.results}</h2>;
        }
    },
    render: function() {
        return <div className="bs">
                <rb.Panel header={this.header()}>
                    <rb.Col xs={3}>
                        <rb.Input type='text' className="ignore" label='Starting clnum' onChange={this.props.onClnumChange} value={this.props.data.options.clnum} placeholder=''/>
                    </rb.Col>
                    <rb.Col xs={9}>
                        {this.makeDisplay()}
                    </rb.Col>
                </rb.Panel>
        </div>;
    }
});

qira.sassApp = React.createClass({
    getInitialState: function() {
        return {
            symbolics: [{name: "testa", type: "register", target: "RAX", size: 0},
                       {name: "testb", type: "memory", target: "0x40007ffea0", size: 16}],
            constraints: [{name: "test1", type: "register", target: "RIP", value: "0x1337beef"},
                          {name: "test2", type: "memory", target: "0x4005cc", value: "0xcoffee"},
                          {name: "test3", type: "memory", target: "0x40007ffea0", value: "0xcoffee"}],
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
        console.log(this.state);
        var sassState = {
            clnum: this.state.options.clnum,
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
        console.log(symbolics);

        sassState.regs = _.map(symbolics.register, function(reg) { return reg.target; });
        sassState.mem = _.map(symbolics.memory, function(mem) { return [parseInt(mem.target), mem.size]; });

        var constraints = groupByType(this.state.constraints);
        console.log(constraints);
        sassState.constraints = {registers: {}, memory: {}};

        //We do not support this in the ui at this time.
        sassState.assist = {};

        console.log(sassState);
    },
    onSolverStart: function(stream) {
        console.log("starting solver");
        stream.emit("startsolver", Session.get("forknum"), 200);
    },
    onSolverStop: function(stream) {
        console.log("stopping solver");
        var newState = React.addons.update(this.state, {
            status: {$set: "waiting"}
        });
        this.setState(newState);
    },
    render: function() {
        var constraintPanel = <qira.sassConstraintPanel
                onDelete={this.handleConstraintDelete}
                onAdd={this.onConstraintAdd}
                constraints={this.state.constraints}/>;

        var symbolicPanel = <qira.sassSymbolicPanel
                onDelete={this.handleSymbolicDelete}
                onAdd={this.onSymbolicAdd}
                symbolics={this.state.symbolics}/>;

        var solverPanel = <qira.sassSolverPanel
                data={this.state}
                onClnumChange={this.onClnumChange}
                onStart={this.onSolverStart}
                onStop={this.onSolverStop}/>;

        return (
            <div className="bs fill">
                <rb.TabbedArea defaultActiveKey={1}>
                    <rb.TabPane eventKey={1} tab='Constraints'>{constraintPanel}</rb.TabPane>
                    <rb.TabPane eventKey={2} tab='Symbolics'>{symbolicPanel}</rb.TabPane>
                    <rb.TabPane eventKey={3} tab='Solver'>{solverPanel}</rb.TabPane>
                </rb.TabbedArea>
            </div>);
  }
});

