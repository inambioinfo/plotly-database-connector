import React, {Component, PropTypes} from 'react';
import {contains, dissoc, eqProps, flip, hasIn, head, isEmpty, keys, merge, propOr, reduce} from 'ramda';
import {connect} from 'react-redux';
import classnames from 'classnames';
import * as Actions from '../../actions/sessions';
import fetch from 'isomorphic-fetch';
import SplitPane from 'react-split-pane';
import {Tab, Tabs, TabList, TabPanel} from 'react-tabs';
import ConnectionTabs from './Tabs/Tabs.react';
import UserConnections from './UserConnections/UserConnections.react';
import DialectSelector from './DialectSelector/DialectSelector.react';
import ConnectButton from './ConnectButton/ConnectButton.react';
import Preview from './Preview/Preview.react';
import TableTree from './Preview/TableTree.react.js';
import OptionsDropdown from './OptionsDropdown/OptionsDropdown.react';
import {Link} from '../Link.react';
import {DIALECTS, FAQ, SQL_DIALECTS_USING_EDITOR} from '../../constants/constants.js';
import {getAllBaseUrls} from '../../utils/utils';


let checkconnectorUrls;
let checkDNS;

class Settings extends Component {
    constructor(props) {
        super(props);
        this.fetchData = this.fetchData.bind(this);
        this.renderEditButton = this.renderEditButton.bind(this);
        this.renderSettingsForm = this.renderSettingsForm.bind(this);
        this.state = {
            editMode: true,
            urls: {
                https: null,
                http: null
            },
            timeElapsed: 0,
            httpsServerIsOK: false
        };
        this.intervals = {
            timeElapsedInterval: null,
            checkHTTPSEndpointInterval: null,
            getConnectorUrlsInterval: null
        }
    }

    componentDidMount() {
        this.fetchData();
        this.intervals.getConnectorUrlsInterval = setInterval(() => {
            // TODO - Clear this?
            this.props.dispatch(Actions.getConnectorUrls());
        }, 5 * 1000);
        let timeElapsed = 0;

        const STARTED_AT = new Date();
        this.intervals.timeElapsedInterval = setInterval(() => {
            const seconds = Math.round((new Date().getTime() - STARTED_AT.getTime()) / 1000);
            const minutes = Math.floor(seconds / 60);
            timeElapsed = seconds > 60 ?
                `${minutes} ${minutes > 1 ? 'minutes' : 'minute'} and ${seconds % 60} seconds` :
                `${seconds} seconds`;
            this.setState({timeElapsed});
        }, 5 * 1000);

        this.intervals.checkHTTPSEndpointInterval = setInterval(() => {
            console.warn(`Attempting a connection at ${this.state.urls.https}`);
            if (this.state.urls.https) {
                fetch(this.state.urls.https).then(() => {
                    this.setState({httpsServerIsOK: true});
                    clearInterval(this.intervals.checkHTTPSEndpointInterval);
                    clearInterval(this.intervals.timeElapsedInterval);
                });
            }
        }, 5 * 1000);

    }

    componentDidUpdate() {
        this.fetchData();
    }

    renderEditButton(show) {
        return (
            <div className={'editButtonContainer'}>
                {show ? (
                    <button
                        className = 'btn-secondary'
                        onClick={() => {
                            this.setState({showConnections: true, editMode: true});
                            this.props.setConnectionNeedToBeSaved(true);
                        }}
                    >
                        {'Edit Credentials'}
                    </button>
                ) : null}
            </div>
        );
    }


    renderSettingsForm() {
        const {
            connect,
            connectionObject,
            connectRequest,
            connectionsHaveBeenSaved,
            saveConnectionsRequest,
            updateConnection
        } = this.props;

        return (
            <div
                className={classnames(
                    'configurationContainer',
                    this.state.editMode ? null : 'disabledSection'
                )}
            >
                <div className={'dialectSelector'}>
                    <DialectSelector
                        connectionObject={connectionObject}
                        updateConnection={updateConnection}
                    />
                </div>
                <UserConnections
                    connectionObject={connectionObject}
                    updateConnection={updateConnection}
                />
                <ConnectButton
                    connectionsHaveBeenSaved={connectionsHaveBeenSaved}
                    connect={connect}
                    connectRequest={connectRequest}
                    editMode={this.state.editMode}
                    saveConnectionsRequest={saveConnectionsRequest}
                />
            </div>
        );
    }

    componentWillReceiveProps(nextProps) {
        // if status goes to 200, credentials have been successfully saved to disk
        if (nextProps.connectRequest.status === 200 &&
            this.props.connectRequest.status !== 200) {
            if (this.state.editMode) {
                this.setState({editMode: false});
            }
            if (this.props.connectionNeedToBeSaved){
                this.props.setConnectionNeedToBeSaved(false);
            }
        }
        if (nextProps.connectorUrlsRequest.status === 200 && this.props.connectorUrlsRequest.status !== 200) {
            this.setState({urls: nextProps.connectorUrlsRequest.content});
        }
    }

    fetchData() {
        const {
            apacheDrillStorageRequest,
            apacheDrillS3KeysRequest,
            connect,
            connections,
            connectRequest,
            connectionsRequest,
            connectionNeedToBeSaved,
            elasticsearchMappingsRequest,
            getApacheDrillStorage,
            getApacheDrillS3Keys,
            getConnectorUrls,
            getElasticsearchMappings,
            getTables,
            getS3Keys,
            getSettings,
            initialize,
            previewTables,
            previewTableRequest,
            selectedTable,
            settingsRequest,
            setConnectionNeedToBeSaved,
            setTable,
            setIndex,
            s3KeysRequest,
            selectedTab,
            selectedIndex,
            tablesRequest
        } = this.props;
        if (connectionsRequest && !connectionsRequest.status ) {
            initialize();
        }
        // keeps the credentials form open until connected
        if (connectRequest.status !== 200 && !this.state.showConnections) {
            this.setState({showConnections: true});
        }
        if (connectRequest.status !== 200 && !this.state.editMode) {
            this.setState({editMode: true});
        }

        // // get the settings to prefill the URL
        if (!settingsRequest.status) {
            getSettings();
        }

        const connectionObject = connections[selectedTab] || {};
        if (contains(connectionObject.dialect, [
                    DIALECTS.APACHE_SPARK,
                    DIALECTS.IBM_DB2,
                    DIALECTS.MYSQL, DIALECTS.MARIADB, DIALECTS.POSTGRES,
                    DIALECTS.REDSHIFT, DIALECTS.MSSQL, DIALECTS.SQLITE
        ])) {
            if (connectRequest.status === 200 && !tablesRequest.status) {
                this.setState({editMode: false});
                getTables();
            }
            if (tablesRequest.status === 200 && !selectedTable) {
                // Don't set the table to be undefined; causes inf loop.
                if (!isEmpty(tablesRequest.content)) {
                    setTable(head(tablesRequest.content));
                }
            }
            if (selectedTable && !previewTableRequest.status) {
                previewTables();
            }
        } else if (connectionObject.dialect === DIALECTS.ELASTICSEARCH) {
            if (connectRequest.status === 200 && !elasticsearchMappingsRequest.status) {
                getElasticsearchMappings();
            }
            if (elasticsearchMappingsRequest.status === 200 && !selectedIndex) {
                // Don't set the index to be undefined; causes inf loop.
                if (!isEmpty(keys(elasticsearchMappingsRequest.content))) {
                    setIndex(head(keys(elasticsearchMappingsRequest.content)));
                }
            }
            if (selectedIndex && !selectedTable) {
                setTable(head(keys(
                    elasticsearchMappingsRequest.content[selectedIndex].mappings
                )));
            }
            if (selectedTable && !previewTableRequest.status) {
                previewTables();
            }
        } else if (connectionObject.dialect === DIALECTS.S3) {
            if (connectRequest.status === 200 && !s3KeysRequest.status) {
                getS3Keys();
            }
        } else if (connectionObject.dialect === DIALECTS.APACHE_DRILL) {
            if (connectRequest.status === 200 && !apacheDrillStorageRequest.status) {
                getApacheDrillStorage();
            }
            if (apacheDrillStorageRequest.status === 200 && !apacheDrillS3KeysRequest.status) {
                getApacheDrillS3Keys();
            }
        }
    }

    render() {
        const {
            apacheDrillStorageRequest,
            apacheDrillS3KeysRequest,
            connect,
            connectRequest,
            connections,
            connectionsHaveBeenSaved,
            connectorUrlsRequest,
            createCerts,
            deleteConnectionsRequest,
            deleteTab,
            elasticsearchMappingsRequest,
            getSqlSchema,
            schemaRequest,
            newTab,
            preview,
            previewTableRequest,
            redirectUrl,
            redirectUrlRequest,
            runSqlQuery,
            queryRequest,
            s3KeysRequest,
            selectedTab,
            settingsRequest,
            saveConnectionsRequest,
            setIndex,
            setTable,
            selectedTable,
            selectedIndex,
            setTab,
            tablesRequest,
            updateConnection,
            updatePreview
        } = this.props;

        if (!selectedTab) {
            return null; // initializing
        }

        const connectorUrl = this.state.urls.https;
        const {httpsServerIsOK, timeElapsed} = this.state;

        const plotlyUrl = (settingsRequest.status === 200 ?
            settingsRequest.content.PLOTLY_URL : 'https://plot.ly'
        );

        const dialect = connections[selectedTab].dialect;

        return (
            <div>
                <ConnectionTabs
                    connections={connections}
                    selectedTab={selectedTab}
                    newTab={newTab}
                    setTab={setTab}
                    deleteTab={deleteTab}
                />

                <div className={'openTab'}>

                    <Tabs defaultIndex={0}>

                        <TabList>
                            <Tab>Connection</Tab>
                            {this.props.connectRequest.status === 200 ? (
                                <Tab>Query</Tab>
                            ) : (
                                <Tab disabled={true}>Loading...</Tab>
                            )}
                            <Tab
                                className="test-ssl-tab react-tabs__tab"
                            >
                                Plot.ly
                            </Tab>
                            <Tab>FAQ</Tab>
                        </TabList>

                        <TabPanel className={['tab-panel-connection','react-tabs__tab-panel']}>
                            {this.renderSettingsForm()}
                            {this.renderEditButton(!this.state.editMode)}
                        </TabPanel>

                        <TabPanel className={['tab-panel-query','react-tabs__tab-panel']}>
                            {this.props.connectRequest.status === 200 ? (
                                <SplitPane
                                    split="vertical"
                                    minSize={10}
                                    defaultSize={200}
                                    maxSize={800}
                                    style={{position:'relative !important'}}
                                >
                                    <div className='tree-view-container'>
                                        {SQL_DIALECTS_USING_EDITOR.includes(dialect) &&
                                            <TableTree
                                                connectionObject={connections[selectedTab]}
                                                preview={preview || {}}
                                                updatePreview={updatePreview}

                                                getSqlSchema={getSqlSchema}
                                                schemaRequest={schemaRequest}
                                            />
                                        }
                                    </div>
                                    <div>
                                        <Preview
                                            connectionObject={connections[selectedTab]}
                                            previewTableRequest={previewTableRequest || {}}
                                            s3KeysRequest={s3KeysRequest}
                                            apacheDrillStorageRequest={apacheDrillStorageRequest}
                                            apacheDrillS3KeysRequest={apacheDrillS3KeysRequest}
                                            preview={preview || {}}
                                            updatePreview={updatePreview}
                                            selectedTable={selectedTable}
                                            elasticsearchMappingsRequest={elasticsearchMappingsRequest}
                                            tablesRequest={tablesRequest}
                                            setTable={setTable}
                                            setIndex={setIndex}
                                            selectedIndex={selectedIndex}
                                            schemaRequest={schemaRequest}
                                            runSqlQuery={runSqlQuery}
                                            queryRequest={queryRequest || {}}
                                        />
                                    </div>
                                </SplitPane>
                            ) : (
                                <div className="big-whitespace-tab">
                                    <p>Please connect to a data store in the Connection tab first.</p>
                                </div>
                            )}
                        </TabPanel>

                        <TabPanel>
                            {this.props.connectRequest.status === 200 ? (
                                <div className="big-whitespace-tab">
                                    {httpsServerIsOK ? (
                                        <div id="test-ssl-initialized" style={{textAlign: 'center'}}>
                                            <img 
                                                src="/static/images/architecture.png" 
                                                style={{border: '1px solid #ebf0f8'}}
                                            >
                                            </img>
                                            <p>
                                                {`The Plotly Database Connector (PDC) can be a middle man between 
                                                    your database and Plot.ly, so that when your database updates, 
                                                    your charts and dashboards update as well. Run PDC on a server 
                                                    for 24/7 dashboard updates, or just keep this app open on an 
                                                    office computer. If you have Plotly On-Premises, this app is 
                                                    already running in your container. Contact your On-Prem admin
                                                    to learn how to connect.`}
                                            </p>

                                            <Link
                                                className='btn-primary'
                                                style={{maxWidth: '50%', marginTop: '40px', marginBottom: '30px'}}
                                                href={`${plotlyUrl}/create?upload=sql&url=${connectorUrl}`}
                                                target="_blank"
                                            >
                                                Query {dialect} from plot.ly
                                            </Link>                                            
                                            <div>
                                                <code>PDC has auto-generated a local URL and SSL certificate for itself: </code>
                                                <br />
                                                <Link
                                                    href={`${plotlyUrl}/create?upload=sql&url=${connectorUrl}`}
                                                    target="_blank"
                                                >
                                                    <strong><code>{connectorUrl}</code></strong>
                                                </Link>
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <p>
                                                {`Plotly is automatically initializing a
                                                  unique SSL certificate and URL for you.
                                                  This can take up to 10 minutes. Once this 
                                                  is complete, you'll be able to query your 
                                                  databases from `}
                                                <Link href={`${plotlyUrl}/create?upload=sql`}>
                                                        Plotly
                                                </Link>
                                                {`. It has been ${timeElapsed}. Check out the
                                                FAQ while you wait! 📰`}
                                            </p>
                                        </div>
                                    )
                                    }
                                </div>
                            ) : (
                                <div className="big-whitespace-tab">
                                    <p>Please connect to a data store in the Connection tab first.</p>
                                </div>
                            )}
                        </TabPanel>

                        <TabPanel>
                            <div className="big-whitespace-tab">
                                <ul>
                                    {FAQ.map(function(obj, i){
                                        return (
                                            <li key={i}>
                                                {obj.q}
                                                <p>{obj.a}</p>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        </TabPanel>
                    </Tabs>
                </div>
            </div>
        );

    }
}

Settings.propTypes = {
// TODO - fill this out.
};

function mapStateToProps(state) {
    const {
        selectedTab,
        tabMap,
        connections,
        connectionsRequest,
        connectRequests,
        connectionsNeedToBeSaved,
        connectorUrlsRequest,
        saveConnectionsRequests,
        deleteConnectionsRequests,
        previewTableRequests,
        tablesRequests,
        elasticsearchMappingsRequests,
        selectedTables,
        selectedIndecies,
        settingsRequest,
        s3KeysRequests,
        apacheDrillStorageRequests,
        apacheDrillS3KeysRequests,
        schemaRequests,
        queryRequests,
        previews
    } = state;

    const selectedConnectionId = tabMap[selectedTab];
    const connectionsHaveBeenSaved = Boolean(selectedConnectionId);
    const selectedTable = selectedTables[selectedConnectionId] || null;
    const selectedIndex = selectedIndecies[selectedConnectionId] || null;

    let previewTableRequest = {};
    if (previewTableRequests[selectedConnectionId] &&
        previewTableRequests[selectedConnectionId][selectedTable]
    ) {
        previewTableRequest = previewTableRequests[selectedConnectionId][selectedTable];
    }

    return {
        connectionsRequest,
        connectRequest: connectRequests[selectedConnectionId] || {},
        saveConnectionsRequest: saveConnectionsRequests[selectedTab] || {},
        deleteConnectionsRequest: deleteConnectionsRequests[selectedConnectionId] || {},
        previewTableRequest,
        tablesRequest: tablesRequests[selectedConnectionId] || {},
        elasticsearchMappingsRequest: elasticsearchMappingsRequests[selectedConnectionId] || {},
        s3KeysRequest: s3KeysRequests[selectedConnectionId] || {},
        apacheDrillStorageRequest: apacheDrillStorageRequests[selectedConnectionId] || {},
        apacheDrillS3KeysRequest: apacheDrillS3KeysRequests[selectedConnectionId] || {},
        selectedTab,
        connections,
        connectionNeedToBeSaved: connectionsNeedToBeSaved[selectedTab] || true,
        connectionsHaveBeenSaved,
        connectionObject: connections[selectedTab],
        preview: previews[selectedConnectionId],
        schemaRequest: schemaRequests[selectedConnectionId],
        queryRequest: queryRequests[selectedConnectionId],
        selectedTable,
        selectedIndex,
        selectedConnectionId,
        settingsRequest,
        connectorUrlsRequest
    };
}

function mapDispatchToProps(dispatch) {
    return {
        initialize: () => {
            dispatch(Actions.getConnections())
            .then(() => dispatch(Actions.initializeTabs()));
        },
        dispatch
    };
}

function mergeProps(stateProps, dispatchProps, ownProps) {
    const {
        selectedTab,
        selectedTable,
        connections,
        selectedConnectionId,
        selectedIndex,
        connectionNeedToBeSaved,
        connectionsHaveBeenSaved,
        connectionObject,
        preview
    } = stateProps;
    const {dispatch} = dispatchProps;

    function boundUpdateConnection(connectionUpdate) {
        dispatch(Actions.updateConnection({
            tableId: selectedTab,
            update: connectionUpdate
        }));
    }
    function boundGetTables() {
        return dispatch(Actions.getTables(selectedConnectionId));
    }
    function boundGetElasticsearchMappings() {
        return dispatch(Actions.getElasticsearchMappings(selectedConnectionId));
    }
    function boundGetS3Keys() {
        return dispatch(Actions.getS3Keys(selectedConnectionId));
    }
    function boundGetApacheDrillStorage() {
        return dispatch(Actions.getApacheDrillStorage(selectedConnectionId));
    }
    function boundGetApacheDrillS3Keys() {
        return dispatch(Actions.getApacheDrillS3Keys(selectedConnectionId));
    }
    function boundSetTable(table) {
        return dispatch(Actions.setTable({[selectedConnectionId]: table}));
    }
    function boundSetIndex(index) {
        return dispatch(Actions.setIndex({[selectedConnectionId]: index}));
    }
    function boundPreviewTables() {
        return dispatch(Actions.previewTable(
            selectedConnectionId,
            connectionObject.dialect,
            selectedTable,
            connectionObject.database || selectedIndex
        ));
    }
    function boundUpdatePreview(previewUpdateObject) {
        return dispatch(Actions.updatePreview(
            merge(
                {connectionId: selectedConnectionId},
                previewUpdateObject
            )
        ));
    }
    function boundSetConnectionNeedToBeSaved(bool) {
        return dispatch(Actions.setConnectionNeedToBeSaved(
            selectedTab,
            bool
        ));
    }
    function boundGetSettings() {
        return dispatch(Actions.getSettings());
    }
    function boundGetSqlSchema() {
        return dispatch(Actions.getSqlSchema(
            selectedConnectionId,
            connectionObject.dialect,
            connectionObject.database
        ));
    }

    function boundRunSqlQuery() {
        return dispatch(Actions.runSqlQuery(
            selectedConnectionId,
            propOr('', 'code', preview)
        ))
    }

    /*
     * dispatchConnect either saves the connection and then connects
     * or just connects if the connections have already been saved
     */
    let dispatchConnect;
    if (!connectionsHaveBeenSaved) {
        dispatchConnect = function saveAndConnect() {
            dispatch(Actions.saveConnections(connections[selectedTab], selectedTab))
            .then(json => {
                /*
                 * Do not try connecting because saving of credentials
                 * will not have happened on error
                 */
                if (!json.error) {
                    dispatch(Actions.connect(json.connectionId));
                }
            });
        };
    } else if (connectionNeedToBeSaved) {
        dispatchConnect = function editConnectionsAndResetRequests() {
            dispatch(Actions.editConnections(connections[selectedTab], selectedConnectionId))
            .then(() => {dispatch(Actions.reset({id: selectedConnectionId}));});
        };
    } else {
        dispatchConnect = () => dispatch(Actions.connect(selectedConnectionId));
    }

    return Object.assign(
        {},
        reduce(flip(dissoc), stateProps, ['dispatch']),
        dispatchProps,
        ownProps, {
            setConnectionNeedToBeSaved: boundSetConnectionNeedToBeSaved,
            updateConnection: boundUpdateConnection,
            getTables: boundGetTables,
            getElasticsearchMappings: boundGetElasticsearchMappings,
            setTable: boundSetTable,
            setIndex: boundSetIndex,
            previewTables: boundPreviewTables,
            getS3Keys: boundGetS3Keys,
            getSettings: boundGetSettings,
            getApacheDrillStorage: boundGetApacheDrillStorage,
            getApacheDrillS3Keys: boundGetApacheDrillS3Keys,
            runSqlQuery: boundRunSqlQuery,
            getSqlSchema: boundGetSqlSchema,
            newTab: () => dispatch(Actions.newTab()),
            deleteTab: tab => dispatch(Actions.deleteTab(tab)),
            setTab: tab => dispatch(Actions.setTab(tab)),
            connect: dispatchConnect,
            editCredential: c => dispatch(Actions.editCredential(c)),
            updatePreview: boundUpdatePreview
        }
    );
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Settings);
