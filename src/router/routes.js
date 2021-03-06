
const routes = [
  {
    path: '/',
    component: () => import('layouts/Content.vue'),
    children: [
      {
        path: '',
        name: 'home',
        component: () => import('pages/Index.vue'),
        meta: {
          requiresAuth: true
        }
      },
      {
        path: 'profile',
        name: 'profile',
        component: () => import('pages/Profile.vue'),
        meta: {
          requiresAuth: true
        }
      },
      {
        path: 'albums/new',
        name: 'AlbumCreate',
        component: () => import('pages/AlbumCreate.vue'),
        meta: {
          requiresAuth: true
        }
      },
      {
        path: 'album/:id',
        name: 'album',
        component: () => import('pages/Album.vue'),
        meta: {
          requiresAuth: true
        }
      },
      {
        path: 'album/:id/edit',
        name: 'AlbumEdit',
        component: () => import('pages/AlbumEdit.vue'),
        meta: {
          requiresAuth: true
        }
      },
      {
        path: 'photo/:id/edit',
        name: 'PhotoEdit',
        component: () => import('pages/PhotoEdit.vue'),
        meta: {
          requiresAuth: true
        }
      },
      {
        path: 'photo/:id/replace',
        name: 'ReplacePhoto',
        component: () => import('pages/Upload.vue'),
        meta: {
          requiresAuth: true
        }
      },
      {
        path: 'upload/:id',
        name: 'Upload',
        component: () => import('pages/Upload.vue'),
        meta: {
          requiresAuth: true
        }
      }
    ]
  },
  {
    path: '/auth',
    component: () => import('layouts/Plain.vue'),
    children: [
      {
        path: '',
        name: 'auth',
        component: () => import('pages/Auth.vue'),
        meta: {
          requiresAuth: false
        }
      }
    ]
  }
]

// Always leave this as last one
if (process.env.MODE !== 'ssr') {
  routes.push({
    path: '*',
    component: () => import('pages/Error404.vue')
  })
}

export default routes
