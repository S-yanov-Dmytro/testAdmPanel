import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Pie, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import './App.css';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const API_BASE = 'http://localhost:5000';

const STATUS_DICTIONARY = {
  'payoff': 'Подтвержден',
  'complectation': 'Комплектация',
  'delivery': 'Доставка',
  'completed': 'Выполнен',
  'return': 'Возврат',
  'new': 'Новый',
  'cancel-other': 'Отменен',
  'duplicate': 'Дубликат',
  'no-call': 'Нет связи',
  'trash': 'Удален',
  'otmena-net-tovara': 'Нет товара',
  'Подтвержден': 'Подтвержден',
  'Комплектация': 'Комплектация',
  'Доставка': 'Доставка',
  'Выполнен': 'Выполнен',
  'Возврат': 'Возврат',
  'Новый': 'Новый',
  'Отменен': 'Отменен',
  'Нет товара': 'Нет товара'
};

const STATUS_COLORS = {
  'Подтвержден': '#4CAF50',
  'Комплектация': '#2196F3',
  'Доставка': '#FF9800',
  'Выполнен': '#9C27B0',
  'Возврат': '#E91E63',
  'Новый': '#607D8B',
  'Отменен': '#F44336',
  'Дубликат': '#795548',
  'Нет связи': '#9E9E9E',
  'Удален': '#333',
  'Нет товара': '#FF5722'
};

function App() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [orders, setOrders] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const refreshInterval = useRef(null);

  const translateStatus = (status) => STATUS_DICTIONARY[status] || status;

  useEffect(() => {
    if (token && autoRefresh) {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
      }

      refreshInterval.current = setInterval(() => {
        fetchOrders(token);
      }, 60000);

      return () => {
        if (refreshInterval.current) {
          clearInterval(refreshInterval.current);
        }
      };
    }
  }, [token, autoRefresh]);

  const fetchOrders = async (token) => {
    setIsLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE}/orders`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000
      });

      if (!data.orders || !data.analytics) {
        throw new Error('Неполные данные от сервера');
      }

      setOrders(data.orders);
      setAnalytics(data.analytics);
      setLastUpdate(new Date(data.timestamp).toLocaleString());
      setError('');
    } catch (err) {
      console.error('Ошибка загрузки:', err);
      setError(err.response?.data?.error || err.message || 'Ошибка загрузки данных');
      setAnalytics(null);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredOrders = orders
    .filter(order => filterStatus === 'all' || order.status === filterStatus)
    .filter(order => order.number.toString().includes(searchQuery));

  const uniqueStatuses = [...new Set(orders.map(order => order.status))];

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_BASE}/login`, { login, password });
      if (res.data.success) {
        setToken(res.data.token);
        fetchOrders(res.data.token);
      } else {
        setError('Неверный логин или пароль');
      }
    } catch (err) {
      setError('Ошибка соединения');
    }
  };

  const handleLogout = () => {
    setToken('');
    setOrders([]);
    setAnalytics(null);
    if (refreshInterval.current) {
      clearInterval(refreshInterval.current);
    }
  };

  const pieData = {
    labels: ['Апрувы', 'Остальные заказы'],
    datasets: [
      {
        data: analytics ? [analytics.approved_orders, analytics.total_orders - analytics.approved_orders] : [0, 0],
        backgroundColor: ['#4CAF50', '#E0E0E0'],
        borderWidth: 1,
      },
    ],
  };

  const barData = {
    labels: ['% Апрува', '% Выкупа'],
    datasets: [
      {
        label: 'Проценты',
        data: analytics ? [analytics.percent_approved, analytics.percent_delivered] : [0, 0],
        backgroundColor: ['#2196F3', '#9C27B0'],
        borderWidth: 1,
      },
    ],
  };

  if (!token) {
    return (
      <div className="login-screen">
        <div className="login-box">
          <h2>Вход в админ-панель</h2>
          <form onSubmit={handleLogin}>
            <input
              type="text"
              placeholder="Логин"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
            />
            <input
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="submit">Войти</button>
          </form>
          {error && <div className="error-message">{error}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <header className="panel-header">
        <h1>Админ-панель заказов</h1>
        <div className="header-controls">
          <span className="update-time">Обновлено: {lastUpdate}</span>
          <div className="refresh-controls">
            <button
              onClick={() => fetchOrders(token)}
              disabled={isLoading}
              className={`refresh-btn ${isLoading ? 'loading' : ''}`}
            >
              {isLoading ? 'Загрузка...' : 'Обновить'}
            </button>
            <label className="auto-refresh-toggle">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Автообновление
            </label>
          </div>
          <button onClick={handleLogout} className="logout-btn">Выйти</button>
        </div>
      </header>

      {error && <div className="error-message">{error}</div>}

      <div className="dashboard">
        <div className="analytics-cards">
          {analytics && [
            { key: 'total_orders', label: 'Всего заказов', isPercent: false },
            { key: 'approved_orders', label: 'Апрувы', isPercent: false },
            { key: 'delivered_orders', label: 'Доставленные', isPercent: false },
            { key: 'percent_approved', label: '% Апрува', isPercent: true },
            { key: 'percent_delivered', label: '% Выкупа', isPercent: true }
          ].map(({ key, label, isPercent }) => (
            <div key={key} className="analytics-card">
              <h3>{label}</h3>
              <p>
                {isPercent
                  ? analytics[key].toFixed(2) + '%'
                  : Math.round(analytics[key])}
              </p>
            </div>
          ))}
        </div>

        <div className="charts-container">
          <div className="chart-box">
            <h3>Соотношение апрувов</h3>
            <div className="chart-wrapper">
              <Pie data={pieData} />
            </div>
          </div>
          <div className="chart-box">
            <h3>Процентные показатели</h3>
            <div className="chart-wrapper">
              <Bar
                data={barData}
                options={{
                  scales: {
                    y: {
                      beginAtZero: true,
                      max: 100,
                      ticks: {
                        callback: function(value) {
                          return value + '%';
                        }
                      }
                    }
                  },
                  plugins: {
                    tooltip: {
                      callbacks: {
                        label: function(context) {
                          return context.raw + '%';
                        }
                      }
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>

        <div className="filters">
          <div className="filter-group">
            <label>Статус:</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">Все статусы</option>
              {uniqueStatuses.map(status => (
                <option key={status} value={status}>
                  {translateStatus(status)}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Поиск:</label>
            <input
              type="text"
              placeholder="Номер заказа"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="orders-table-container">
          <div className="table-header">
            <h3>Заказы ({filteredOrders.length})</h3>
          </div>
          <div className="table-scroll-wrapper">
            <table className="orders-table">
              <thead>
                <tr>
                  <th>Номер</th>
                  <th>Статус</th>
                  <th>Товары без доставки</th>
                  <th>Всего товаров</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length > 0 ? (
                  filteredOrders.map(order => (
                    <tr key={order.number}>
                      <td>{order.number}</td>
                      <td>
                        <span
                          className="status-badge"
                          style={{backgroundColor: STATUS_COLORS[translateStatus(order.status)]}}
                        >
                          {translateStatus(order.status)}
                        </span>
                      </td>
                      <td>{order.qty_without_delivery}</td>
                      <td>{order.total_qty}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="no-orders">Нет заказов</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;