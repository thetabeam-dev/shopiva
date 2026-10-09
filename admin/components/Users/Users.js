"use client"

import React, { useEffect, useState } from 'react'
import './style.css'

const ROLES = ["All", "admin", "support", "manager"]
const OSS = ["All", "Windows", "macOS", "Linux"]

export default function Users() {
  const [selectedRole, setSelectedRole] = useState('All')
  const [selectedOs, setSelectedOs] = useState('All')
  const [filterEmail, setFilterEmail] = useState('')
  const [filterPhone, setFilterPhone] = useState('')
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true;
    const fetchUsers = async () => {
      setLoading(true)
      setError('')
      const params = new URLSearchParams()
      if (selectedRole && selectedRole !== 'All') params.set('role', selectedRole)
      if (selectedOs && selectedOs !== 'All') params.set('os', selectedOs)
      if (filterEmail) params.set('email', filterEmail)
      if (filterPhone) params.set('phone', filterPhone)
      try {
        const res = await fetch(`/api/users?${params.toString()}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || 'Unable to load users.')
        if (isMounted && Array.isArray(json.users)) setUsers(json.users)
      } catch (err) {
        if (isMounted) setError(err.message || 'Unable to load users.')
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    fetchUsers()
    return () => { isMounted = false }
  }, [selectedRole, selectedOs, filterEmail, filterPhone])

  return (
    <section className="users-page">
      <div className="users-summary">
        <div>
          <span className="section-kicker">PEOPLE</span>
          <h1>Registered users</h1>
          <p>Filter users by role and operating system to review active accounts and system usage.</p>
        </div>
        <div className="users-count"><strong>{users.length}</strong><span>users found</span></div>
      </div>

      <div className="users-filters">
        <div>
          <label htmlFor="role-select">Role</label>
          <select id="role-select" value={selectedRole} onChange={(event) => setSelectedRole(event.target.value)}>
            {ROLES.map((role) => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="os-select">Operating system</label>
          <select id="os-select" value={selectedOs} onChange={(event) => setSelectedOs(event.target.value)}>
            {OSS.map((os) => (
              <option key={os} value={os}>{os}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="email-filter">Email</label>
          <input id="email-filter" type="text" placeholder="Filter by email" value={filterEmail} onChange={(e) => setFilterEmail(e.target.value)} />
        </div>
        <div>
          <label htmlFor="phone-filter">Phone</label>
          <input id="phone-filter" type="text" placeholder="Filter by phone" value={filterPhone} onChange={(e) => setFilterPhone(e.target.value)} />
        </div>
        <button
          type="button"
          className="filter-reset-button"
          onClick={() => {
            setSelectedRole('All')
            setSelectedOs('All')
            setFilterEmail('')
            setFilterPhone('')
          }}
        >
          Clear filters
        </button>
      </div>

      {error && <div className="resource-alert" role="alert">{error}</div>}

      <div className="users-table-card">
        <div className="users-table-header">
          <span aria-live="polite">{loading ? 'Loading users…' : `${users.length} users shown`}</span>
          <span>{selectedRole !== 'All' ? `${selectedRole} role selected` : 'All roles'}</span>
        </div>
        <table className="users-table" aria-busy={loading}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>OS</th>
              <th>Phone</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>{user.role}</td>
                <td>{user.os || ''}</td>
                <td>{user.phone || ''}</td>
              </tr>
            ))}
            {users.length === 0 && !loading && (
              <tr>
                <td colSpan="5" className="empty-row">No users match the selected filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
