import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Search, SlidersHorizontal, X, Briefcase } from 'lucide-react'
import { tasksApi } from '../api/client'
import TaskCard from '../components/TaskCard'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import { TASK_CATEGORIES } from '../types'

export default function BrowseTasksPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    category: searchParams.get('category') || '',
    status: 'open',
    min_budget: '',
    max_budget: '',
    sort_by: 'newest',
    page: 1,
  })
  const [showFilters, setShowFilters] = useState(false)

  const queryParams = {
    ...filters,
    page: filters.page,
    per_page: 12,
    min_budget: filters.min_budget || undefined,
    max_budget: filters.max_budget || undefined,
    category: filters.category || undefined,
    search: filters.search || undefined,
    status: filters.status || undefined,
  }

  const { data, isLoading, isFetching } = useQuery<{ total: number; tasks: any[]; pages: number }>({
    queryKey: ['tasks', queryParams],
    queryFn: () => tasksApi.list(queryParams).then((r) => r.data),
    placeholderData: keepPreviousData,
  })

  const handleFilter = (key: string, value: string | number) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }))
  }

  const clearFilters = () => {
    setFilters({
      search: '',
      category: '',
      status: 'open',
      min_budget: '',
      max_budget: '',
      sort_by: 'newest',
      page: 1,
    })
    setSearchParams({})
  }

  const hasActiveFilters = filters.search || filters.category || filters.min_budget || filters.max_budget

  return (
    <div className="page-container">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Browse Tasks</h1>
        <p className="text-gray-500">
          {data?.total ? `${data.total} tasks available` : 'Find the right opportunity'}
        </p>
      </div>

      {/* Search + Filter Bar */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={filters.search}
            onChange={(e) => handleFilter('search', e.target.value)}
            className="input pl-9 w-full"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`btn btn-outline gap-2 ${showFilters ? 'border-blue-500 text-blue-600' : ''}`}
        >
          <SlidersHorizontal size={16} />
          Filters
          {hasActiveFilters && (
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">
              {[filters.search, filters.category, filters.min_budget, filters.max_budget].filter(Boolean).length}
            </span>
          )}
        </button>
        <select
          value={filters.sort_by}
          onChange={(e) => handleFilter('sort_by', e.target.value)}
          className="input w-auto"
        >
          <option value="newest">Newest</option>
          <option value="budget_high">Budget: High to Low</option>
          <option value="budget_low">Budget: Low to High</option>
          <option value="deadline">By Deadline</option>
        </select>
      </div>

      {/* Expanded Filters */}
      {showFilters && (
        <div className="card p-5 mb-6 animate-fade-in">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="label">Category</label>
              <select
                value={filters.category}
                onChange={(e) => handleFilter('category', e.target.value)}
                className="input"
              >
                <option value="">All Categories</option>
                {TASK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilter('status', e.target.value)}
                className="input"
              >
                <option value="">All Status</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div>
              <label className="label">Min Budget ($)</label>
              <input
                type="number"
                placeholder="0"
                value={filters.min_budget}
                onChange={(e) => handleFilter('min_budget', e.target.value)}
                className="input"
                min={0}
              />
            </div>
            <div>
              <label className="label">Max Budget ($)</label>
              <input
                type="number"
                placeholder="Any"
                value={filters.max_budget}
                onChange={(e) => handleFilter('max_budget', e.target.value)}
                className="input"
                min={0}
              />
            </div>
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="mt-3 flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700"
            >
              <X size={14} /> Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Category Pills */}
      <div className="flex gap-2 flex-wrap mb-6 overflow-x-auto pb-1">
        <button
          onClick={() => handleFilter('category', '')}
          className={`badge cursor-pointer transition-all whitespace-nowrap py-1.5 px-3 text-sm ${
            !filters.category ? 'bg-blue-600 text-white' : 'badge-gray hover:badge-blue'
          }`}
        >
          All
        </button>
        {TASK_CATEGORIES.slice(0, 8).map((cat) => (
          <button
            key={cat}
            onClick={() => handleFilter('category', cat)}
            className={`badge cursor-pointer transition-all whitespace-nowrap py-1.5 px-3 text-sm ${
              filters.category === cat ? 'bg-blue-600 text-white' : 'badge-gray hover:badge-blue'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Results */}
      {isLoading ? (
        <LoadingSpinner fullPage />
      ) : (data?.tasks?.length ?? 0) > 0 ? (
        <>
          <div className={`grid gap-4 md:grid-cols-2 lg:grid-cols-3 ${isFetching ? 'opacity-70' : ''}`}>
            {data!.tasks.map((task: any) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>

          {/* Pagination */}
          {data!.pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-10">
              <button
                onClick={() => handleFilter('page', filters.page - 1)}
                disabled={filters.page === 1}
                className="btn btn-outline btn-sm disabled:opacity-40"
              >
                Previous
              </button>
              {Array.from({ length: Math.min(data!.pages, 7) }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => handleFilter('page', p)}
                  className={`btn btn-sm w-9 ${p === filters.page ? 'btn-primary' : 'btn-outline'}`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => handleFilter('page', filters.page + 1)}
                disabled={filters.page >= data!.pages}
                className="btn btn-outline btn-sm disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        <EmptyState
          icon={Briefcase}
          title="No tasks found"
          description={
            hasActiveFilters
              ? 'No tasks match your filters. Try adjusting your search.'
              : 'No tasks have been posted yet. Be the first!'
          }
          action={
            hasActiveFilters ? (
              <button onClick={clearFilters} className="btn btn-primary">
                Clear Filters
              </button>
            ) : undefined
          }
        />
      )}
    </div>
  )
}
