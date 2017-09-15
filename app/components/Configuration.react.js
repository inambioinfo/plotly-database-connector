import cookie from 'react-cookies'
import React, { Component, PropTypes } from 'react';
import DropdownMenu from 'react-dd-menu';
import ImmutablePropTypes from 'react-immutable-proptypes';
import Settings from './Settings/Settings.react';
import {baseUrl} from '../utils/utils';
import {Link} from './Link.react';
import {contains} from 'ramda';

const LINKS = {
    PLANS: 'http://plot.ly/plans/',
    DOCS: 'http://help.plot.ly/database-connectors/',
    TYPEFORM: 'https://plotly.typeform.com/to/KUiCSl',
    GITHUB: 'https://github.com/plotly/plotly-database-connector',
    ABOUT: 'https://plot.ly/database-connectors/'
};
const ONPREM = contains('external-data-connector', window.location.href);

export default class Configuration extends Component {
    constructor(props) {
        super(props);
        this.state = {
            isMenuOpen: false,
            userName: cookie.load('db-connector-user')
        }
        this.toggle = this.toggle.bind(this);
        this.close = this.close.bind(this);
        this.logOut = this.logOut.bind(this);

    }

    componentDidUpdate() {
      this.setState({
        userName: cookie.load('db-connector-user')
      });
    }

    toggle() {
        this.setState({ isMenuOpen: !this.state.isMenuOpen });
    }

    close() {
        this.setState({ isMenuOpen: false });
    }

    logOut() {

      // Delete all the cookies and reset user state. This does not kill
      // any running connections, but user will not be able to access them
      // without logging in again.
      cookie.remove('db-connector-user');
      cookie.remove('plotly-auth-token');
      cookie.remove('db-connector-auth-token');
      this.setState({ userName: ''});
      window.location.assign('/');
    }

    render() {
        const menuOptions = {
            isOpen: this.state.isMenuOpen,
            close: this.close,
            toggle: <button type="button" onClick={this.toggle}>MENU</button>,
            align: 'right',
            animate: false
        };
        const loginMessage = this.state.userName ?
                            <div>
                                Logged in as "{this.state.userName}" &nbsp;
                                <Link className={styles.supportLinks} onClick={this.logOut} >
                                    Log Out
                                </Link>
                            </div>
                            :
                            <Link className={styles.supportLinks} href="/">Log In</Link>;

        return (
            <div className="fullApp">
                <Settings/>
            </div>

        );
    }
}

Configuration.propTypes = {
    sessionsActions: PropTypes.object
};
