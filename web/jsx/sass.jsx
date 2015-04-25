window.qira = window.qira || {};
var qira = window.qira;
var rb = window.ReactBootstrap;

qira.determineAddressMapping = function(address) {
    var pmaps = Session.get("pmaps");

    if(pmaps === undefined) {
        return undefined;
    }

    var mapAddresses = _.keys(pmaps);
    var ranges = _.sortBy(_.map(mapAddresses, function(addr) {
        return {label: addr, value: parseInt(addr)};
    }));

    var type = undefined;
    for(var i = 1; i < ranges.length; i++) {
        var mapAddress = ranges[i].value;
        if(mapAddress > parseInt(address)) {
            if(i > 0) {
                type = pmaps[ranges[i-1].label];
                break;
            }
        }
    }
    return type;
};

qira.sassConstraintPanel = React.createClass({
    createConstraint: function(constraint) {
        var deleteButton = <rb.Glyphicon glyph="remove" className="pull-right" onClick={this.props.onDelete.bind(this, constraint)}></rb.Glyphicon>;
        var constraintType = constraint.type == "memory" ? this.createMemoryConstraint : this.createRegisterConstraint;
        return (<rb.ListGroupItem>{constraintType(constraint)} {deleteButton}</rb.ListGroupItem>);
    },
    createMemoryConstraint: function(constraint) {
        var link = <span className = {"datamemory addr addr_" + constraint.target}>{constraint.target}</span>;
        return <div><rb.Label bsStyle="primary">MEM</rb.Label> {link}</div>;
    },
    createRegisterConstraint: function(constraint) {
        var link = <span className = "register">{constraint.target}</span>;
        return <div><rb.Label bsStyle="info">REG</rb.Label> {link}</div>;
    },
    header: <div>
          Constraints <rb.Button bsSize='small' className="align-right">
            <b>+</b> Add
          </rb.Button>
        </div>,
    render: function() {
        var constraintItems = this.props.constraints.map(this.createConstraint);
        return (<div className="bs">
                <rb.Panel header={this.header}>
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
            constraints: [{name: "test", type: "register", target: "RIP", value: "0x1337beef"},
                          {name: "test", type: "memory", target: "0xffaabbcc", value: "0xcoffee"}]
        };
    },
    handleConstraintDelete: function(constraint) {
        var newConstraints = _.reject(this.state.constraints, function (item) {
            return item == constraint;
        });

        this.setState({constraints: newConstraints});
    },
    render: function() {
        return (
                <div className="bs fill">
                <rb.Col xs={6} className="fill">
                <qira.sassConstraintPanel
            onDelete={this.handleConstraintDelete}
            constraints={this.state.constraints}/> </rb.Col>
                </div>);
    }
});

