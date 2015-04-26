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

    return <span className = {type + " addr addr_" + address}>{address}</span>;
};

qira.sassAddConstraintModal = React.createClass({
    mixins: [React.addons.LinkedStateMixin],
    getInitialState: function() {
        return {name: "", target: "", value:"", type:"memory"};
    },
    getForms: function() {
        if(this.state.type === "memory") {
            return <div> 
            <rb.Input type='text' className="ignore" label='Address' valueLink={this.linkState('target')}  placeholder=''/>
            <rb.Input type='text' className="ignore" label='Value' valueLink={this.linkState('value')} placeholder=''/>
            </div>
        } else {
            return <div> 
            <rb.Input type='text' className="ignore" label='Value' valueLink={this.linkState('value')} placeholder=''/>
            </div>
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
        
        return (<h4 className="panel-title">
             Constraints {addButton}
                </h4>);
    },
    render: function() {
        var constraintItems = this.props.constraints.map(this.createConstraint);
        
        if(constraintItems.length == 0) {
           constraintItems = <p>To take advantage of the constraint solver add some constraints above.</p>;
        }
        return (<div className="bs">
                  <rb.Panel header={this.header()}>
                  <ul className="list-group">
                  {constraintItems}
                  </ul>
                  </rb.Panel>
            </div>);
    }
});

qira.sassApp = React.createClass({
    getInitialState: function() {
        return {
            constraints: [{name: "test1", type: "register", target: "RIP", value: "0x1337beef"},
                          {name: "test2", type: "memory", target: "0x4005cc", value: "0xcoffee"},
                          {name: "test3", type: "memory", target: "0x40007ffea0", value: "0xcoffee"}]
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
    render: function() {
        return (
                <div className="bs fill">
                <rb.Col xs={4} className="fill">
                <qira.sassConstraintPanel
                onDelete={this.handleConstraintDelete}
                onAdd={this.onConstraintAdd}
                constraints={this.state.constraints}/>
                </rb.Col>
                </div>);
    }
});

