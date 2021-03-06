<template lang="pug">
  q-page.column(padding)
    .text-h6(v-if="activeAlbum") {{ activeAlbum.name }}
    y-uploader.col.fit(
      v-if="ensureCredentials"
      ref="fileUploader"
      :s3Key="getFullKey"
      :metadata="getMetadata"
      :bucket= "bucket"
      :region= "region"
      :credentials="credentials"
      :options="{partSize: 10 * 1024 * 1024, queueSize: 5}"
      :maxConcurrentUploads="5"
      :multiple="this.$route.name==='Upload'"
      @finish="finish"
      @uploaded="uploaded"
      @added="added"
      :useAccelerateEndpoint="accelerationConfig()"
    )
</template>

<script>
import { uid, date } from 'quasar'
import { createPhoto, updatePhoto, updateAlbum, getPhoto } from 'src/graphql/queryAlbum'
import { YUploader } from 'components/uploader'
import AlbumCounters from 'src/mixins/albumCounters'

const path = require('path')

const slug = require('slug')
slug.defaults.mode = 'rfc3986'
slug.defaults.modes.rfc3986.lower = true

export default {
  name: 'UploadPhotos',
  data () {
    return {
      credentials: null,
      userInfo: null,
      uploadBatch: null,
      albumId: null,
      photoId: null,
      photoToReplace: null,
      position: 1,
      dialogData: null,
      showDialog: false,
      bucket: this.$Amplify.Storage._config.AWSS3.bucket,
      region: this.$Amplify.Storage._config.AWSS3.region
    }
  },
  components: {
    YUploader
  },
  mixins: [
    AlbumCounters
  ],
  computed: {
    ensureCredentials () {
      const hasCredentials = (this.credentials && this.credentials.authenticated && this.credentials.authenticated === true && this.userInfo)
      let hasPhotoInfo = false
      if (this.$route.name === 'Upload') {
        hasPhotoInfo = true
      } else {
        hasPhotoInfo = this.photoToReplace !== null
      }
      return hasCredentials && hasPhotoInfo
    },
    activeAlbum () {
      return this.$store.state.albums.active
    }
  },
  created () {
    if (!this.activeAlbum) {
      this.$router.replace({ name: 'album' })
      return
    }
    if (this.$route.name === 'Upload') {
      this.albumId = this.$route.params.id
      this.position = this.activeAlbum.photosCount + 1
    } else {
      this.photoId = this.$route.params.id
      this.fetchPhotoToReplace(this.photoId)
    }
    this.$Amplify.Auth.currentCredentials()
      .then(credentials => {
        this.credentials = this.$Amplify.Auth.essentialCredentials(credentials)
      })
      .catch(err => { // eslint-disable-line handle-callback-err
        this.$Logger.error(err)
        this.credentials = null
      })
    this.$Amplify.Auth.currentUserInfo().then(userInfo => {
      this.userInfo = userInfo
    })
    this.uploadBatch = uid()
  },
  methods: {
    fetchPhotoToReplace (id) {
      this.$Amplify.API.graphql(
        this.$Amplify.graphqlOperation(getPhoto, { id })
      ).then(({ data }) => {
        this.photoToReplace = data.getPhoto
        this.albumId = this.photoToReplace.albumId
      })
    },
    finish () {
      this.updateCovers()
        .then(data => {
          return this.updateCounters(this.activeAlbum.id)
        })
        .then(data => {
          this.$router.push({ name: 'album', params: { id: this.activeAlbum.id } })
        })
    },
    updateCovers () {
      const covers = this.activeAlbum.covers || []
      const coversToAdd = this.$refs.fileUploader.files.slice(0, (4 - covers.length)).map(f => {
        return {
          id: f.__id,
          contentType: f.type,
          file: {
            key: this.getKey(f)
          },
          width: f.__width,
          height: f.__height,
          updatedAt: f.__updatedAt,
          slug: slug(path.basename(f.name, path.extname(f.name)))
        }
      })
      if (coversToAdd.length > 0) {
        const newCovers = [...covers, ...coversToAdd]
        const input = {
          id: this.albumId,
          covers: JSON.stringify(newCovers)
        }
        return this.$Amplify.API.graphql(
          this.$Amplify.graphqlOperation(updateAlbum, { input })
        )
      }
      return Promise.resolve(true)
    },
    parseExifDateTime (datetime) {
      const re = /(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/
      const matches = datetime.match(re)
      return date.buildDate({ year: matches[1], month: matches[2], date: matches[3], hours: matches[4], minutes: matches[5], seconds: matches[6] })
    },
    uploaded ({ file }) {
      const nowStamp = Date.now()
      let capturedAt = date.formatDate(file.lastModified, 'YYYY-MM-DDTHH:mm:ss.SSSZ')
      if (file.__exif) {
        if (file.__exif.DateTime) {
          capturedAt = date.formatDate(this.parseExifDateTime(file.__exif.DateTime), 'YYYY-MM-DDTHH:mm:ss.SSSZ')
        }
        if (file.__exif.DateTimeOriginal) {
          capturedAt = date.formatDate(this.parseExifDateTime(file.__exif.DateTimeOriginal), 'YYYY-MM-DDTHH:mm:ss.SSSZ')
        }
        if (file.__exif.DateTimeDigitized) {
          capturedAt = date.formatDate(this.parseExifDateTime(file.__exif.DateTimeDigitized), 'YYYY-MM-DDTHH:mm:ss.SSSZ')
        }
      }
      file.__updatedAt = date.formatDate(nowStamp, 'YYYY-MM-DDTHH:mm:ss.SSSZ')
      const input = {
        id: file.__id,
        albumId: this.albumId,
        position: file.__position,
        file: {
          bucket: this.bucket,
          key: this.getKey(file),
          region: this.region
        },
        width: file.__width,
        height: file.__height,
        size: parseInt(file.size),
        contentType: file.type,
        name: file.name,
        slug: slug(path.basename(file.name, path.extname(file.name))),
        visibility: 'public',
        status: 'published',
        capturedAt,
        publishedAt: file.__updatedAt
      }
      const query = this.photoToReplace ? updatePhoto : createPhoto
      this.$Amplify.API.graphql(
        this.$Amplify.graphqlOperation(query, { input })
      )
    },
    added (files) {
      for (let i = 0; i < files.length; i++) {
        if (this.$route.name === 'Upload') {
          const photoId = uid()
          files[i].__position = this.position
          files[i].__id = photoId
          this.position++
        } else {
          files[i].__position = this.photoToReplace.position
          files[i].__id = this.photoToReplace.id
        }
      }
    },
    getKey (file) {
      return `${this.albumId}/${file.__id}/${file.name}`
    },
    getFullKey (file) {
      return `public/${this.getKey(file)}`
    },
    getMetadata (file) {
      return {
        owner: this.userInfo.username,
        filename: file.name,
        modifiedAt: file.lastModified.toString(),
        uploadedAt: new Date().toISOString(),
        uploadBatch: this.uploadBatch,
        albumId: this.albumId,
        photoId: file.__id,
        orientation: file.__orientation.toString(),
        width: file.__width.toString(),
        height: file.__height.toString()
      }
    },
    accelerationConfig () {
      if (process.env.transferAcceleration && process.env.transferAcceleration === 'true') {
        return true
      }
      return false
    }
  }
}
</script>
<style lang="sass">
.q-linear-progress
  &.border-primary
    border-style: solid
    border-width: 1px
    border-color: $grey-8
.q-img__content
  > div
    &.q-pa-none
      padding: 0
    &.q-px-none
      padding-left: 0
      padding-right: 0
    &.q-py-none
      padding-top: 0
      padding-bottom: 0
    &.q-px-xs
      padding-right: 4px
      padding-left: 4px
</style>
