import cookie from 'react-cookies'
import fetch from 'isomorphic-fetch';
import React, {Component} from 'react';
import {render} from 'react-dom';
import {
    baseUrl,
    dynamicRequireElectron
} from '../utils/utils';
import {Link} from '../components/Link.react';
import {productName, version} from '../../package.json';
import {contains} from 'ramda';


const currentEndpoint = '/login';
const baseUrlWrapped = baseUrl().replace(currentEndpoint, '');
const connectorUrl = '/database-connector';

const CLOUD = 'cloud';
const ONPREM = 'onprem';
const SERVER_TYPES = {
    [CLOUD]: 'Plotly Cloud',
    [ONPREM]: 'Plotly On-Premise'
};

window.document.title = `${productName} v${version}`;

// http://stackoverflow.com/questions/4068373/center-a-popup-window-on-screen
const PopupCenter = (url, title, w, h) => {
    // Fixes dual-screen position
    const dualScreenLeft = window.screenLeft != undefined ? window.screenLeft : screen.left;
    const dualScreenTop = window.screenTop != undefined ? window.screenTop : screen.top;

    const width = window.innerWidth ? window.innerWidth : document.documentElement.clientWidth ? document.documentElement.clientWidth : screen.width;
    const height = window.innerHeight ? window.innerHeight : document.documentElement.clientHeight ? document.documentElement.clientHeight : screen.height;

    const left = ((width / 2) - (w / 2)) + dualScreenLeft;
    const top = ((height / 2) - (h / 2)) + dualScreenTop;
    const popupWindow = window.open(url, title, 'scrollbars=yes, width=' + w + ', height=' + h + ', top=' + top + ', left=' + left);
    return popupWindow;
};

class Login extends Component {
    constructor(props) {
        super(props);
        this.state = {
            domain: '',
            statusMessage: '',
            serverType: CLOUD,
            status: '',
            statusMessage: '',
            username: ''
        };
        this.buildOauthUrl = this.buildOauthUrl.bind(this);
        this.oauthPopUp = this.oauthPopUp.bind(this);
        this.logIn = this.logIn.bind(this);
    }

    componentDidMount() {
        const userName = cookie.load('db-connector-user');

        if (userName) {
          window.location.assign(connectorUrl);
        }
    }

    componentDidUpdate() {
        const userName = cookie.load('db-connector-user');

        if (userName) {
          window.location.assign(connectorUrl);
        }
    }


    buildOauthUrl() {
        const oauthClientId = 'isFcew9naom2f1khSiMeAtzuOvHXHuLwhPsM7oPt';
        const isOnPrem = this.state.serverType === ONPREM;
        const plotlyDomain = isOnPrem ? this.state.domain : 'https://plot.ly';
        const redirect_uri = baseUrlWrapped;
        return (
            `${plotlyDomain}/o/authorize/?response_type=token&` +
            `client_id=${oauthClientId}&` +
            `redirect_uri=${redirect_uri}/oauth2/callback`
        );
    }

    oauthPopUp() {
        try {
            const electron = dynamicRequireElectron();
            const oauthUrl = this.buildOauthUrl();
            electron.shell.openExternal(oauthUrl);
        } catch (e) {
            console.log('Unable to openExternal, opening a popupWindow instead:');
            console.log(e);
            const popupWindow = PopupCenter(
                this.buildOauthUrl(), 'Authorization', '500', '500'
            );
            if (window.focus) {
                popupWindow.focus();
            }
        }
    }

    logIn () {
        const {domain, serverType, username} = this.state;

        this.setState({status: '', statusMessage: ''});

        let PLOTLY_API_SSL_ENABLED = true;
        let PLOTLY_API_DOMAIN = '';

        if (!username) {
            this.setState({
                status: 'failure',
                statusMessage: 'Enter your Plotly username.'
            });
            return;
        }
        if (serverType === ONPREM) {

            if (domain.startsWith('http://')) {
                PLOTLY_API_SSL_ENABLED = false;
                PLOTLY_API_DOMAIN = domain.replace('http://', '');
            } else if (domain.startsWith('https://')) {
                PLOTLY_API_SSL_ENABLED = true;
                PLOTLY_API_DOMAIN = domain.replace('https://', '');
            } else {
                this.setState({
                    status: 'failure',
                    statusMessage: (
                        'Please enter a valid Plotly Domain.'
                    )
                });
                return;
            }
        }

        this.setState({
            statusMessage: (
                <div>
                    <div>
                        {`Authorizing ${username}...`}
                    </div>
                    <div>
                        {`You may be redirected to ${domain ? domain : 'https://plot.ly'} and asked to log in.`}
                    </div>
                    <hr />
                    {`(If a login or authorization window does not pop up, visit: `}
                      <br /><Link href={this.buildOauthUrl()}>
                          {this.buildOauthUrl()}
                      </Link><br />
                    {` in your web browser.)`}
                   <hr />
                </div>
            )
        });

        /*
         * If the user is on-prem, then set the domain as a setting,
         * and after that's done send them through the oauth redirect.
         */
        if (this.state.serverType === ONPREM) {
            return fetch(`${baseUrlWrapped}/settings`, {
                method: 'PATCH',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    PLOTLY_API_DOMAIN, PLOTLY_API_SSL_ENABLED
                })
            }).then(res => {
                if (res.status === 200) {
                    this.oauthPopUp();
                } else {
                    this.setState({
                        status: 'failure',
                        statusMessage: (
                            'There was an error while trying to log in. '+
                            'Try restarting the app and trying again.'
                        )
                    });
                }
            }).catch(console.error);
        } else {
            this.oauthPopUp();
        }

    }


    render() {

        return (
            <div className="loginPage">
                <h2>
                    {'Plotly Database Connector'}
                </h2>
                <h4>
                    {'Log in to Plotly to continue'}
                </h4>

                <div>
                    <div className="inputLabel">
                        <label>Connect to Plotly Cloud</label>
                        <input
                            type="radio"
                            checked={this.state.serverType !== ONPREM}
                            onChange={() => {this.setState({serverType: CLOUD})}}
                        />
                    </div>

                    <div className="inputLabel">
                        <label>Connect to <Link href="https://plot.ly/products/on-premise/">Plotly On-Premise</Link></label>
                        <input
                            type="radio"
                            checked={this.state.serverType === ONPREM}
                            onChange={() => {this.setState({serverType: ONPREM})}}
                        />
                    </div>

                    {
                        this.state.serverType == ONPREM ? (
                            <div className="inputLabel">
                                <label>Your Plotly On-Premise Domain</label>
                                <input
                                    type="text"
                                    placeholder="https://plotly.your-company.com"
                                    onChange={e => this.setState({
                                        domain: e.target.value
                                    })}
                                />
                            </div>
                        ) : null
                    }

                    <div className="inputLabel">
                        <label>Your Plotly Username</label>
                        <input
                            id="test-username"
                            type="text"
                            placeholder=""
                            onChange={e => this.setState({
                                username: e.target.value
                            })}
                        />
                    </div>
                </div>

                <div>
                    <button id="test-login-button" onClick={this.logIn}>
                        {'Log in'}
                    </button>
                </div>

                <div className="signupMessage">
                    {this.state.statusMessage}
                </div>

                <div className="signupMessage">
                    <span>
                        {`The Plotly Database Connector requires a Plotly login to use.
                          Don't have an account yet?`}
                    </span>
                </div>

                <Link href={`${this.state.plotlyDomain}/accounts/login/?action=signup`}>
                    {'Create an account '}
                </Link>

            </div>
        );
    }
}

render(<Login/>, document.getElementById('root'));
