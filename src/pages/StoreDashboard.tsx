import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Store, Plus, Upload, Package, ExternalLink, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { storeApi, usersApi } from '../api/client'
import LoadingSpinner from '../components/LoadingSpinner'

export default function StoreDashboardPage() {
  const queryClient = useQueryClient()
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [productForm, setProductForm] = useState({
    title: '',
    description: '',
    price: '',
    category: '',
    is_service: false,
    delivery_time: '',
  })

  const { data: store, isLoading, error } = useQuery({
    queryKey: ['my-store'],
    queryFn: () => storeApi.getMyStore().then((r) => r.data),
    retry: false,
  })

  const { data: earningsData } = useQuery({
    queryKey: ['my-earnings'],
    queryFn: () => usersApi.getEarnings().then((r) => r.data),
  })

  const addProductMutation = useMutation({
    mutationFn: () =>
      storeApi.addProduct({
        ...productForm,
        price: Number(productForm.price),
        delivery_time: productForm.delivery_time || undefined,
      }),
    onSuccess: () => {
      toast.success('Product added!')
      setShowAddProduct(false)
      setProductForm({ title: '', description: '', price: '', category: '', is_service: false, delivery_time: '' })
      queryClient.invalidateQueries({ queryKey: ['my-store'] })
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Failed to add product'),
  })

  const deleteProductMutation = useMutation({
    mutationFn: (id: string) => storeApi.deleteProduct(id),
    onSuccess: () => {
      toast.success('Product deleted')
      queryClient.invalidateQueries({ queryKey: ['my-store'] })
    },
  })

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await storeApi.uploadLogo(file)
      toast.success('Logo updated!')
      queryClient.invalidateQueries({ queryKey: ['my-store'] })
    } catch { toast.error('Failed to upload logo') }
  }

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await storeApi.uploadBanner(file)
      toast.success('Banner updated!')
      queryClient.invalidateQueries({ queryKey: ['my-store'] })
    } catch { toast.error('Failed to upload banner') }
  }

  if (isLoading) return <LoadingSpinner fullPage />

  if (error || !store) {
    return (
      <div className="page-container max-w-lg mx-auto text-center py-20">
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Store size={28} className="text-gray-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">No Store Yet</h2>
        <p className="text-gray-500 mb-6">Create your store to start selling services and products</p>
        <Link to="/store/create" className="btn btn-primary btn-lg">
          <Plus size={17} /> Create My Store
        </Link>
      </div>
    )
  }

  return (
    <div className="page-container">
      {/* Banner */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[#1e3a5f] to-blue-600 h-36 mb-16">
        {store.banner_url && (
          <img src={store.banner_url} alt="Banner" className="w-full h-full object-cover" />
        )}
        <label className="absolute bottom-3 right-3 btn btn-sm bg-white/20 text-white hover:bg-white/30 backdrop-blur cursor-pointer">
          <Upload size={13} /> Upload Banner
          <input type="file" accept="image/*" onChange={handleBannerUpload} className="sr-only" />
        </label>

        {/* Logo */}
        <div className="absolute -bottom-10 left-6">
          <div className="relative">
            {store.logo_url ? (
              <img src={store.logo_url} alt="Logo" className="w-20 h-20 rounded-2xl object-cover border-4 border-white shadow-lg" />
            ) : (
              <div className="w-20 h-20 bg-white border-4 border-white rounded-2xl shadow-lg flex items-center justify-center">
                <Store size={28} className="text-gray-400" />
              </div>
            )}
            <label className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center cursor-pointer">
              <Upload size={11} className="text-white" />
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="sr-only" />
            </label>
          </div>
        </div>
      </div>

      {/* Store Info */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{store.name}</h1>
            <span className={`badge ${store.status === 'active' ? 'badge-green' : 'badge-red'}`}>
              {store.status}
            </span>
          </div>
          {store.description && <p className="text-gray-500 mt-1 max-w-xl">{store.description}</p>}
          <div className="flex gap-3 mt-2 text-sm text-gray-500">
            {store.contact_email && <span>{store.contact_email}</span>}
            {store.website && (
              <a href={store.website} target="_blank" rel="noopener" className="flex items-center gap-1 text-blue-600 hover:underline">
                <ExternalLink size={13} /> Website
              </a>
            )}
          </div>
        </div>
        <Link to={`/stores/${store.slug}`} className="btn btn-outline btn-sm">
          <ExternalLink size={14} /> View Public Page
        </Link>
      </div>

      {/* Earnings Dashboard */}
      {earningsData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="card p-5 bg-blue-50 border-blue-100">
            <p className="text-sm font-medium text-blue-600 mb-1">Gross Sales</p>
            <p className="text-2xl font-bold text-blue-900">₹{earningsData.gross_sales.toFixed(2)}</p>
          </div>
          <div className="card p-5 bg-red-50 border-red-100">
            <p className="text-sm font-medium text-red-600 mb-1">Platform Fees</p>
            <p className="text-2xl font-bold text-red-900">₹{earningsData.total_commission_deducted.toFixed(2)}</p>
          </div>
          <div className="card p-5 bg-green-50 border-green-100">
            <p className="text-sm font-medium text-green-600 mb-1">Net Earnings</p>
            <p className="text-2xl font-bold text-green-900">₹{earningsData.net_earnings.toFixed(2)}</p>
          </div>
          <div className="card p-5 bg-purple-50 border-purple-100">
            <p className="text-sm font-medium text-purple-600 mb-1">Wallet Balance</p>
            <p className="text-2xl font-bold text-purple-900">₹{earningsData.wallet_balance.toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* Products */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-semibold text-gray-900">Products & Services</h2>
            <p className="text-sm text-gray-500">{store.products.length} items</p>
          </div>
          <button onClick={() => setShowAddProduct(!showAddProduct)} className="btn btn-primary btn-sm">
            <Plus size={15} /> Add Product
          </button>
        </div>

        {/* Add Product Form */}
        {showAddProduct && (
          <div className="bg-gray-50 rounded-xl p-5 mb-5 border border-gray-200 animate-fade-in">
            <h3 className="font-medium text-gray-900 mb-4">Add New Product / Service</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Title *</label>
                <input
                  value={productForm.title}
                  onChange={(e) => setProductForm((f) => ({ ...f, title: e.target.value }))}
                  className="input"
                  placeholder="Product or service name"
                />
              </div>
              <div>
                <label className="label">Price ($) *</label>
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={productForm.price}
                  onChange={(e) => setProductForm((f) => ({ ...f, price: e.target.value }))}
                  className="input"
                  placeholder="29.99"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Description</label>
                <textarea
                  value={productForm.description}
                  onChange={(e) => setProductForm((f) => ({ ...f, description: e.target.value }))}
                  className="input resize-none"
                  rows={2}
                  placeholder="What's included?"
                />
              </div>
              <div>
                <label className="label">Category</label>
                <input
                  value={productForm.category}
                  onChange={(e) => setProductForm((f) => ({ ...f, category: e.target.value }))}
                  className="input"
                  placeholder="e.g. Design, Development"
                />
              </div>
              <div>
                <label className="label">Delivery Time</label>
                <input
                  value={productForm.delivery_time}
                  onChange={(e) => setProductForm((f) => ({ ...f, delivery_time: e.target.value }))}
                  className="input"
                  placeholder="e.g. 3 days"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_service"
                  checked={productForm.is_service}
                  onChange={(e) => setProductForm((f) => ({ ...f, is_service: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="is_service" className="text-sm text-gray-700 cursor-pointer">
                  This is a service (not a physical product)
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowAddProduct(false)} className="btn btn-outline btn-sm">Cancel</button>
              <button
                onClick={() => addProductMutation.mutate()}
                disabled={addProductMutation.isPending || !productForm.title || !productForm.price}
                className="btn btn-primary btn-sm"
              >
                {addProductMutation.isPending ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : 'Add Product'}
              </button>
            </div>
          </div>
        )}

        {store.products.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {store.products.map((product: any) => (
              <div key={product.id} className="border border-gray-200 rounded-xl p-4 hover:border-blue-300 transition-colors group">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{product.title}</p>
                    {product.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{product.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => deleteProductMutation.mutate(product.id)}
                    className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-green-700 font-bold">${product.price}</span>
                  <div className="flex items-center gap-1.5">
                    {product.is_service && <span className="badge badge-blue text-xs">Service</span>}
                    {product.delivery_time && (
                      <span className="text-xs text-gray-400">{product.delivery_time}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10">
            <Package size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-gray-500 text-sm">No products yet. Add your first one!</p>
          </div>
        )}
      </div>
    </div>
  )
}
