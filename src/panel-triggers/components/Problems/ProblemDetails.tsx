import React, { PureComponent } from 'react';
import moment from 'moment';
import * as utils from '../../../datasource-zabbix/utils';
import { MODE_ITEMID, MODE_METRICS } from '../../../datasource-zabbix/constants';
import { ProblemDTO, ZBXHost, ZBXGroup, ZBXEvent, ZBXTag, ZBXAlert } from '../../../datasource-zabbix/types';
import { ZBXItem, GFTimeRange, RTRow } from '../../types';
import { AckModal, AckProblemData } from '../AckModal';
import EventTag from '../EventTag';
import ProblemStatusBar from './ProblemStatusBar';
import AcknowledgesList from './AcknowledgesList';
import ProblemTimeline from './ProblemTimeline';
import { FAIcon, Tooltip, ModalController } from '../../../components';
import { renderUrl } from '../../utils';
import { getLocationSrv } from '@grafana/runtime';

interface ProblemDetailsProps extends RTRow<ProblemDTO> {
  rootWidth: number;
  timeRange: GFTimeRange;
  showTimeline?: boolean;
  panelId?: number;
  getProblemEvents: (problem: ProblemDTO) => Promise<ZBXEvent[]>;
  getProblemAlerts: (problem: ProblemDTO) => Promise<ZBXAlert[]>;
  onProblemAck?: (problem: ProblemDTO, data: AckProblemData) => Promise<any> | any;
  onTagClick?: (tag: ZBXTag, datasource: string, ctrlKey?: boolean, shiftKey?: boolean) => void;
}

interface ProblemDetailsState {
  events: ZBXEvent[];
  alerts: ZBXAlert[];
  show: boolean;
}

export class ProblemDetails extends PureComponent<ProblemDetailsProps, ProblemDetailsState> {
  constructor(props) {
    super(props);
    this.state = {
      events: [],
      alerts: [],
      show: false,
    };
  }

  componentDidMount() {
    if (this.props.showTimeline) {
      this.fetchProblemEvents();
    }
    this.fetchProblemAlerts();
    requestAnimationFrame(() => {
      this.setState({ show: true });
    });
  }

  handleTagClick = (tag: ZBXTag, ctrlKey?: boolean, shiftKey?: boolean) => {
    if (this.props.onTagClick) {
      this.props.onTagClick(tag, this.props.original.datasource, ctrlKey, shiftKey);
    }
  }

  fetchProblemEvents() {
    const problem = this.props.original;
    this.props.getProblemEvents(problem)
    .then(events => {
      this.setState({ events });
    });
  }

  fetchProblemAlerts() {
    const problem = this.props.original;
    this.props.getProblemAlerts(problem)
    .then(alerts => {
      this.setState({ alerts });
    });
  }

  ackProblem = (data: AckProblemData) => {
    const problem = this.props.original as ProblemDTO;
    return this.props.onProblemAck(problem, data);
  }

  openInExplore = () => {
    const problem = this.props.original as ProblemDTO;
    let query: any = {};

    if (problem.items?.length === 1 && problem.hosts?.length === 1) {
      const item = problem.items[0];
      const host = problem.hosts[0];
      query = {
        queryType: MODE_METRICS,
        group: { filter: '/.*/' },
        application: { filter: '' },
        host: { filter: host.name },
        item: { filter: item.name },
      };
    } else {
      const itemids = problem.items?.map(p => p.itemid).join(',');
      query = {
        queryType: MODE_ITEMID,
        itemids: itemids,
      };
    }

    const state: any = {
      datasource: problem.datasource,
      context: 'explore',
      originPanelId: this.props.panelId,
      queries: [query],
    };

    const exploreState = JSON.stringify(state);
    const url = renderUrl('/explore', { left: exploreState });
    getLocationSrv().update({ path: url, query: {} });
  };

  render() {
    const problem = this.props.original as ProblemDTO;
    const alerts = this.state.alerts;
    const rootWidth = this.props.rootWidth;
    const displayClass = this.state.show ? 'show' : '';
    const wideLayout = rootWidth > 1200;
    const compactStatusBar = rootWidth < 800 || problem.acknowledges && wideLayout && rootWidth < 1400;
    const age = moment.unix(problem.timestamp).fromNow(true);
    const showAcknowledges = problem.acknowledges && problem.acknowledges.length !== 0;
    const problemSeverity = Number(problem.severity);

    return (
      <div className={`problem-details-container ${displayClass}`}>
        <div className="problem-details">
          <div className="problem-details-row">
            <div className="problem-value-container">
              <div className="problem-age">
                <FAIcon icon="clock-o" />
                <span>{age}</span>
              </div>
              {problem.items && <ProblemItems items={problem.items} />}
            </div>
            <ExploreButton onClick={this.openInExplore} />
            <ProblemStatusBar problem={problem} alerts={alerts} className={compactStatusBar && 'compact'} />
            {problem.showAckButton &&
              <div className="problem-actions">
                <ModalController>
                  {({ showModal, hideModal }) => (
                    <ProblemActionButton
                      className="navbar-button navbar-button--settings"
                      icon="reply-all"
                      tooltip="Acknowledge problem"
                      onClick={() => {
                        showModal(AckModal, {
                          canClose: problem.manual_close === '1',
                          severity: problemSeverity,
                          onSubmit: this.ackProblem,
                          onDismiss: hideModal,
                        });
                      }}
                    />
                  )}
                </ModalController>
              </div>
            }
          </div>
          {problem.comments &&
            <div className="problem-description-row">
              <div className="problem-description">
                <span className="description-label">Description:&nbsp;</span>
                <span>{problem.comments}</span>
              </div>
            </div>
          }
          {problem.tags && problem.tags.length > 0 &&
            <div className="problem-tags">
              {problem.tags && problem.tags.map(tag =>
                <EventTag
                  key={tag.tag + tag.value}
                  tag={tag}
                  highlight={tag.tag === problem.correlation_tag}
                  onClick={this.handleTagClick}
                />)
              }
            </div>
          }
          {this.props.showTimeline && this.state.events.length > 0 &&
            <ProblemTimeline events={this.state.events} timeRange={this.props.timeRange} />
          }
          {showAcknowledges && !wideLayout &&
            <div className="problem-ack-container">
              <h6><FAIcon icon="reply-all" /> Acknowledges</h6>
              <AcknowledgesList acknowledges={problem.acknowledges} />
            </div>
          }
        </div>
        {showAcknowledges && wideLayout &&
          <div className="problem-details-middle">
            <div className="problem-ack-container">
              <h6><FAIcon icon="reply-all" /> Acknowledges</h6>
              <AcknowledgesList acknowledges={problem.acknowledges} />
            </div>
          </div>
        }
        <div className="problem-details-right">
          <div className="problem-details-right-item">
            <FAIcon icon="database" />
            <span>{problem.datasource}</span>
          </div>
          {problem.proxy &&
            <div className="problem-details-right-item">
              <FAIcon icon="cloud" />
              <span>{problem.proxy}</span>
            </div>
          }
          {problem.groups && <ProblemGroups groups={problem.groups} className="problem-details-right-item" />}
          {problem.hosts && <ProblemHosts hosts={problem.hosts} className="problem-details-right-item" />}
        </div>
      </div>
    );
  }
}

interface ProblemItemProps {
  item: ZBXItem;
  showName?: boolean;
}

function ProblemItem(props: ProblemItemProps) {
  const { item, showName } = props;
  const itemName = utils.expandItemName(item.name, item.key_);
  return (
    <Tooltip placement="bottom" content={itemName}>
      <div className="problem-item">
        <FAIcon icon="thermometer-three-quarters" />
        {showName && <span className="problem-item-name">{item.name}: </span>}
        <span className="problem-item-value">{item.lastvalue}</span>
      </div>
    </Tooltip>
  );
}

interface ProblemItemsProps {
  items: ZBXItem[];
}

class ProblemItems extends PureComponent<ProblemItemsProps> {
  render() {
    const { items } = this.props;
    return (items.length > 1 ?
      items.map(item => <ProblemItem item={item} key={item.itemid} showName={true} />) :
      <ProblemItem item={items[0]} />
    );
  }
}

interface ProblemGroupsProps {
  groups: ZBXGroup[];
  className?: string;
}

class ProblemGroups extends PureComponent<ProblemGroupsProps> {
  render() {
    return this.props.groups.map(g => (
      <div className={this.props.className || ''} key={g.groupid}>
        <FAIcon icon="folder" />
        <span>{g.name}</span>
      </div>
    ));
  }
}

interface ProblemHostsProps {
  hosts: ZBXHost[];
  className?: string;
}

class ProblemHosts extends PureComponent<ProblemHostsProps> {
  render() {
    return this.props.hosts.map(h => (
      <div className={this.props.className || ''} key={h.hostid}>
        <FAIcon icon="server" />
        <span>{h.name}</span>
      </div>
    ));
  }
}

interface ProblemActionButtonProps {
  icon: string;
  tooltip?: string;
  className?: string;
  onClick?: (event?) => void;
}

class ProblemActionButton extends PureComponent<ProblemActionButtonProps> {
  handleClick = (event) => {
    this.props.onClick(event);
  }

  render() {
    const { icon, tooltip, className } = this.props;
    let button = (
      <button className={`btn problem-action-button ${className || ''}`} onClick={this.handleClick}>
        <FAIcon icon={icon} />
      </button>
    );
    if (tooltip) {
      button = (
        <Tooltip placement="bottom" content={tooltip}>
          {button}
        </Tooltip>
      );
    }
    return button;
  }
}

interface ExploreButtonProps {
  onClick: (event?) => void;
}

const ExploreButton: React.FC<ExploreButtonProps> = ({ onClick }) => {
  return (
    <button className="btn problem-explore-button" onClick={onClick}>
      <FAIcon icon="compass" /><span>Explore</span>
    </button>
  );
};
